import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-base-url.token';

interface EnvWindow {
  __env?: {
    API_BASE_URL?: string;
  };
}

type GlobalWithEnvWindow = typeof globalThis & { window?: EnvWindow };

const testGlobal = globalThis as GlobalWithEnvWindow;

describe('API_BASE_URL token', () => {
  const originalWindow = testGlobal.window;

  const setWindow = (value: EnvWindow | undefined) => {
    if (value) {
      testGlobal.window = value;
    } else {
      delete testGlobal.window;
    }
  };

  afterEach(() => {
    if (typeof originalWindow !== 'undefined') {
      setWindow(originalWindow);
    } else {
      setWindow(undefined);
    }
  });

  it('falls back to localhost when window is undefined', () => {
    setWindow(undefined);
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({});
    const token = TestBed.inject(API_BASE_URL);

    expect(token).toBe('http://localhost:3000');
  });

  it('factory yields fallback when window missing', () => {
    setWindow(undefined);
    const factory = (API_BASE_URL as unknown as { ɵprov: { factory: () => string } }).ɵprov.factory;
    expect(factory()).toBe('http://localhost:3000');
  });

  it('uses fallback when window env missing', () => {
    const stubWindow: EnvWindow = originalWindow ? { ...originalWindow } : {};
    setWindow(stubWindow);
    delete stubWindow.__env;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const token = TestBed.inject(API_BASE_URL);

    expect(token).toBe('http://localhost:3000');
  });
  it('uses fallback when env value missing', () => {
    const stubWindow: EnvWindow = originalWindow ? { ...originalWindow } : {};
    stubWindow.__env = {};
    setWindow(stubWindow);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const token = TestBed.inject(API_BASE_URL);

    expect(token).toBe('http://localhost:3000');
  });
  it('reads value from window.__env.API_BASE_URL when available', () => {
    const stubWindow: EnvWindow = originalWindow ? { ...originalWindow } : {};
    stubWindow.__env = { API_BASE_URL: 'https://api.example.com' };
    setWindow(stubWindow);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const token = TestBed.inject(API_BASE_URL);

    expect(token).toBe('https://api.example.com');
  });
});
