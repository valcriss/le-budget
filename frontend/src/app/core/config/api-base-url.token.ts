import { InjectionToken } from '@angular/core';

declare global {
  interface Window {
    __env?: {
      API_BASE_URL?: string;
    };
  }
}

const FALLBACK_API_BASE_URL = 'http://localhost:3000';

const resolveApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return FALLBACK_API_BASE_URL;
  }

  return window.__env?.API_BASE_URL ?? FALLBACK_API_BASE_URL;
};

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => resolveApiBaseUrl(),
});
