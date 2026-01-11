import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthStore } from '../auth/auth.store';

type EventCallback = (payload: unknown) => void;

@Injectable({ providedIn: 'root' })
export class EventsGateway {
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  private source: EventSource | null = null;
  private readonly listeners = new Map<string, Set<EventCallback>>();
  private readonly handlers = new Map<string, (event: MessageEvent) => void>();
  private currentToken: string | null = null;

  constructor() {
    const effectRef = effect(() => {
      const token = this.authStore.accessToken();
      if (token === this.currentToken) {
        return;
      }
      this.currentToken = token ?? null;
      this.dispose();
      if (this.currentToken && this.listeners.size > 0) {
        this.ensureConnected();
      }
    });
    this.destroyRef.onDestroy(() => effectRef.destroy());
  }

  on(event: string, callback: EventCallback): () => void {
    /* istanbul ignore next -- jsdom always defines window */
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    let callbacks = this.listeners.get(event);
    if (!callbacks) {
      callbacks = new Set<EventCallback>();
      this.listeners.set(event, callbacks);
      this.ensureListener(event);
    }
    callbacks.add(callback);

    this.ensureConnected();

    return () => {
      const set = this.listeners.get(event);
      set?.delete(callback);
      if (set && set.size === 0) {
        this.listeners.delete(event);
        const handler = this.handlers.get(event);
        if (handler && this.source) {
          this.source.removeEventListener(event, handler);
        }
        this.handlers.delete(event);
      }
      if (this.listeners.size === 0) {
        this.dispose();
      }
    };
  }

  private ensureConnected(): void {
    if (this.source || typeof window === 'undefined') {
      return;
    }

    if (!this.currentToken) {
      return;
    }

    /* istanbul ignore next */
    const base = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
    const url = `${base}/events?access_token=${encodeURIComponent(this.currentToken)}`;
    this.source = new EventSource(url);

    for (const [event, handler] of this.handlers.entries()) {
      this.source.addEventListener(event, handler);
    }

    this.source.addEventListener('error', () => {
      this.dispose();
      setTimeout(() => this.ensureConnected(), 2000);
    });
  }

  private ensureListener(event: string): void {
    if (this.handlers.has(event)) {
      return;
    }

    const handler = (e: MessageEvent) => {
      const payload = this.parseData(e.data);
      const callbacks = this.listeners.get(event);
      if (!callbacks) {
        return;
      }
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (error) {
          console.error('SSE listener error', error);
        }
      });
    };

    this.handlers.set(event, handler);
    if (this.source) {
      this.source.addEventListener(event, handler);
    }
  }

  private parseData(data: unknown): unknown {
    if (typeof data !== 'string') {
      return data;
    }
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  private dispose(): void {
    if (!this.source) {
      return;
    }
    for (const [event, handler] of this.handlers.entries()) {
      this.source.removeEventListener(event, handler);
    }
    this.source.close();
    this.source = null;
  }
}
