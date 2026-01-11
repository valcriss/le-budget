import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-base-url.token';

interface EnvWindow {
  __env?: {
    API_BASE_URL?: string;
  };
}

describe('API_BASE_URL token', () => {
  const originalWindow = (globalThis as EnvWindow & typeof globalThis).window;
  const setWindow = (value: EnvWindow | undefined) => {
    if (typeof window === 'undefined') {
      (globalThis as EnvWindow & typeof globalThis).window = value;
      return;
    }
    (window as EnvWindow & Window).__env = value?.__env;
  };

  afterEach(() => {
    setWindow(originalWindow);
    TestBed.resetTestingModule();
  });

  const configureToken = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(API_BASE_URL);
  };

  it('falls back to localhost when window is undefined', () => {
    setWindow(undefined);
    expect(configureToken()).toBe('http://localhost:3000');
  });

  it('factory yields fallback when window missing', () => {
    setWindow(undefined);
    const factory = (API_BASE_URL as any)['\u0275prov'].factory as () => string;
    expect(factory()).toBe('http://localhost:3000');
  });

  it('uses fallback when window env missing', () => {
    setWindow({});
    expect(configureToken()).toBe('http://localhost:3000');
  });

  it('uses fallback when env value missing', () => {
    setWindow({ __env: {} });
    expect(configureToken()).toBe('http://localhost:3000');
  });

  it('reads value from window.__env.API_BASE_URL when available', () => {
    setWindow({ __env: { API_BASE_URL: 'https://api.example.com' } });
    expect(configureToken()).toBe('https://api.example.com');
  });
});
