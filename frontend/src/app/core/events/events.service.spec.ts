import { TestBed } from '@angular/core/testing';
import { DestroyRef, WritableSignal, signal } from '@angular/core';
import { EventsGateway } from './events.service';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthStore } from '../auth/auth.store';

type EventsGatewayInternals = EventsGateway & {
  currentToken: string | null;
  ensureConnected(): void;
  dispose(): void;
  ensureListener(event: string): void;
  handlers: Map<string, (event: MessageEvent) => void>;
};

type EventListener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly listeners = new Map<string, Set<EventListener>>();
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: EventListener) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, data: unknown) {
    const message = { data } as MessageEvent;
    this.listeners.get(event)?.forEach((handler) => handler(message));
  }

  close() {
    this.closed = true;
  }
}

interface TestWindow {
  EventSource?: typeof MockEventSource;
}

type TestGlobal = typeof globalThis & {
  window?: TestWindow;
  EventSource?: typeof MockEventSource;
};

const testGlobal = globalThis as TestGlobal;

describe('EventsGateway', () => {
  const originalEventSource = testGlobal.EventSource;
  const originalWindow = testGlobal.window;
  let tokenSignal: WritableSignal<string | null>;
  let accessTokenSpy: jest.Mock;
  let destroyCallbacks: Array<() => void>;
  let destroyRefStub: DestroyRef;
  const setWindow = (value: TestWindow | undefined) => {
    if (value) {
      testGlobal.window = value;
    } else {
      delete testGlobal.window;
    }
  };

  beforeEach(() => {
    MockEventSource.instances = [];
    testGlobal.EventSource = MockEventSource;
    setWindow({ EventSource: MockEventSource });
    tokenSignal = signal<string | null>(null);
    accessTokenSpy = jest.fn(() => tokenSignal());
    destroyCallbacks = [];
    destroyRefStub = { onDestroy: (cb: () => void) => destroyCallbacks.push(cb) };

    TestBed.configureTestingModule({
      providers: [
        EventsGateway,
        { provide: API_BASE_URL, useValue: 'https://api.test' },
        { provide: AuthStore, useValue: { accessToken: accessTokenSpy } as AuthStore },
        { provide: DestroyRef, useValue: destroyRefStub },
      ],
    });
  });

  afterEach(() => {
    tokenSignal.set(null);
    if (originalEventSource) {
      testGlobal.EventSource = originalEventSource;
    } else {
      delete testGlobal.EventSource;
    }
    setWindow(originalWindow);
    destroyCallbacks.splice(0).forEach((cb) => cb());
  });

  function connect(gateway: EventsGateway) {
    tokenSignal.set('token');
    const internals = gateway as EventsGatewayInternals;
    internals.currentToken = 'token';
    internals.ensureConnected();
  }

  async function connectViaEffect(gateway: EventsGateway, token = 'token') {
    tokenSignal.set(token);
    const flush = (TestBed as typeof TestBed & { flushEffects?: () => void }).flushEffects;
    if (typeof flush === 'function') {
      flush();
    }
    await Promise.resolve();
  }

  it('wires listeners and forwards parsed payloads', () => {
    const gateway = TestBed.inject(EventsGateway);
    const handler = jest.fn();

    const dispose = gateway.on('budget.updated', handler);
    connect(gateway);

    expect(MockEventSource.instances).toHaveLength(1);
    const instance = MockEventSource.instances[0];
    instance.emit('budget.updated', JSON.stringify({ id: 1 }));
    expect(handler).toHaveBeenCalledWith({ id: 1 });

    dispose();
    expect(instance.closed).toBe(true);
  });

  it('reacts to token changes via effect and avoids redundant reconnects', async () => {
    const gateway = TestBed.inject(EventsGateway);
    const internals = gateway as EventsGatewayInternals;
    const disposeSpy = jest.spyOn(internals, 'dispose');
    gateway.on('budget.updated', jest.fn());

    await connectViaEffect(gateway, 'token-1');
    expect(internals.currentToken).toBe('token-1');
    expect(MockEventSource.instances).toHaveLength(1);
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    disposeSpy.mockClear();
    await connectViaEffect(gateway, 'token-1');
    expect(disposeSpy).not.toHaveBeenCalled();

    await connectViaEffect(gateway, 'token-2');
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it('does not recreate the source when already connected', async () => {
    const gateway = TestBed.inject(EventsGateway);
    gateway.on('accounts.updated', jest.fn());

    await connectViaEffect(gateway);
    expect(MockEventSource.instances).toHaveLength(1);

    (gateway as EventsGatewayInternals).ensureConnected();
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('reconnects when the EventSource triggers an error', () => {
    jest.useFakeTimers();
    const gateway = TestBed.inject(EventsGateway);
    const internals = gateway as EventsGatewayInternals;
    const ensureSpy = jest.spyOn(internals, 'ensureConnected');
    gateway.on('budget.updated', jest.fn());
    connect(gateway);

    expect(MockEventSource.instances).toHaveLength(1);
    const first = MockEventSource.instances[0];
    first.emit('error', {});
    expect(first.closed).toBe(true);

    jest.advanceTimersByTime(2000);
    jest.runOnlyPendingTimers();
    expect(ensureSpy).toHaveBeenCalledTimes(3); // initial effect + manual connect + retry
    expect(MockEventSource.instances).toHaveLength(2);
    jest.useRealTimers();
  });

  it('does not connect when window undefined or token missing', () => {
    const gateway = TestBed.inject(EventsGateway);
    const original = testGlobal.window;
    setWindow(undefined);
    const cleanup = gateway.on('foo', jest.fn());
    expect(cleanup()).toBeUndefined();
    expect(MockEventSource.instances).toHaveLength(0);

    setWindow({ EventSource: MockEventSource });
    tokenSignal.set(null);
    gateway.on('bar', jest.fn());
    expect(MockEventSource.instances).toHaveLength(0);

    setWindow(undefined);
    (gateway as EventsGatewayInternals).ensureConnected();
    expect(MockEventSource.instances).toHaveLength(0);
    setWindow(original);
  });

  it('delivers raw payloads when json parsing fails', () => {
    const gateway = TestBed.inject(EventsGateway);
    const handler = jest.fn();
    gateway.on('accounts.updated', handler);
    connect(gateway);

    expect(MockEventSource.instances).toHaveLength(1);
    const instance = MockEventSource.instances[0];
    instance.emit('accounts.updated', 'raw-data');

    expect(handler).toHaveBeenCalledWith('raw-data');
  });

  it('is a noop when window is not defined', () => {
    const original = testGlobal.window;
    setWindow(undefined);

    const gateway = TestBed.inject(EventsGateway);
    const cleanup = gateway.on('test', jest.fn());

    expect(MockEventSource.instances).toHaveLength(0);
    expect(cleanup).toBeInstanceOf(Function);
    expect(cleanup()).toBeUndefined();

    setWindow(original);
  });

  it('attaches additional listeners to existing sources and skips duplicates', async () => {
    const gateway = TestBed.inject(EventsGateway);
    const first = gateway.on('first', jest.fn());

    await connectViaEffect(gateway);
    const source = MockEventSource.instances[0];
    const addSpy = jest.spyOn(source, 'addEventListener');

    const second = gateway.on('second', jest.fn());
    expect(addSpy).toHaveBeenCalledWith('second', expect.any(Function));

    addSpy.mockClear();
    const third = gateway.on('second', jest.fn());
    expect(addSpy).not.toHaveBeenCalled();

    (gateway as EventsGatewayInternals).ensureListener('second');
    expect(addSpy).not.toHaveBeenCalled();

    third();
    second();
    first();
  });

  it('ignores orphan events once callbacks removed', async () => {
    const gateway = TestBed.inject(EventsGateway);
    const dispose = gateway.on('orphan', jest.fn());

    await connectViaEffect(gateway);
    const handler = (gateway as EventsGatewayInternals).handlers.get('orphan');
    expect(typeof handler).toBe('function');

    dispose();
    handler?.({ data: JSON.stringify({}) } as MessageEvent);
  });

  it('forwards non-string payloads unchanged', () => {
    const gateway = TestBed.inject(EventsGateway);
    const handler = jest.fn();
    gateway.on('raw', handler);
    connect(gateway);

    const instance = MockEventSource.instances[0];
    const payload = { raw: true };
    instance.emit('raw', payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('logs listener errors without interrupting delivery', () => {
    const gateway = TestBed.inject(EventsGateway);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const handler = jest.fn(() => {
      throw new Error('boom');
    });
    const okHandler = jest.fn();
    gateway.on('boom', handler);
    gateway.on('boom', okHandler);
    connect(gateway);

    const instance = MockEventSource.instances[0];
    instance.emit('boom', JSON.stringify({}));

    expect(errorSpy).toHaveBeenCalledWith('SSE listener error', expect.any(Error));
    expect(okHandler).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
