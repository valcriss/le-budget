import { TestBed } from '@angular/core/testing';
import { DestroyRef, signal } from '@angular/core';
import { EventsGateway } from './events.service';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthStore } from '../auth/auth.store';

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

describe('EventsGateway', () => {
  const originalEventSource = (globalThis as any).EventSource;
  const originalWindow = (globalThis as any).window;
  const tokenSignal = signal<string | null>('token');
  const authStoreStub = { accessToken: () => tokenSignal() } as unknown as AuthStore;
  const destroyCallbacks: Array<() => void> = [];
  const destroyRefStub: DestroyRef = { onDestroy: (cb) => destroyCallbacks.push(cb) };

  beforeEach(() => {
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
    (globalThis as any).window = { EventSource: MockEventSource };

    TestBed.configureTestingModule({
      providers: [
        EventsGateway,
        { provide: API_BASE_URL, useValue: 'https://api.test' },
        { provide: AuthStore, useValue: authStoreStub },
        { provide: DestroyRef, useValue: destroyRefStub },
      ],
    });
  });

  afterEach(() => {
    (globalThis as any).EventSource = originalEventSource;
    (globalThis as any).window = originalWindow;
    destroyCallbacks.splice(0).forEach((cb) => cb());
  });

  it('creates an EventSource and forwards events to listeners', () => {
    const service = TestBed.inject(EventsGateway);
    expect(typeof window).not.toBe('undefined');
    expect((service as any).currentToken).toBe('token');

    const handler = jest.fn();
    const dispose = service.on('budget.updated', handler);

    expect(MockEventSource.instances).toHaveLength(1);
    const instance = MockEventSource.instances[0];
    expect(instance.url).toBe('https://api.test/events?access_token=token');

    instance.emit('budget.updated', JSON.stringify({ id: 1 }));
    expect(handler).toHaveBeenCalledWith({ id: 1 });

    dispose();
    expect(instance.closed).toBe(true);
    expect(instance.listeners.get('budget.updated')?.size ?? 0).toBe(0);
  });

  it('reconnects after an EventSource error', () => {
    jest.useFakeTimers();
    const service = TestBed.inject(EventsGateway);
    service.on('budget.updated', jest.fn());

    expect(MockEventSource.instances).toHaveLength(1);
    const first = MockEventSource.instances[0];

    first.emit('error', {});
    jest.advanceTimersByTime(2000);

    expect(MockEventSource.instances).toHaveLength(2);
    jest.useRealTimers();
  });

  it('parses non-json payloads as-is', () => {
    const service = TestBed.inject(EventsGateway);
    const handler = jest.fn();
    service.on('accounts.updated', handler);

    const instance = MockEventSource.instances[0];
    instance.emit('accounts.updated', 'raw-data');

    expect(handler).toHaveBeenCalledWith('raw-data');
  });

  it('disposes connections when token becomes null', () => {
    const service = TestBed.inject(EventsGateway);
    service.on('test', jest.fn());
    const first = MockEventSource.instances[0];
    expect(first.closed).toBeFalse?.() ?? expect(first.closed).toBe(false);

    tokenSignal.set(null);

    expect(first.closed).toBe(true);
  });
});
