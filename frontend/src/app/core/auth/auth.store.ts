import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from './auth.models';
import { SKIP_AUTH_REFRESH } from './auth-http-context.tokens';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const STORAGE_KEY = 'le-budget:auth';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private refreshPromise: Promise<boolean> | null = null;

  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly tokenSignal = signal<string | null>(null);
  private readonly refreshTokenSignal = signal<string | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly user = this.userSignal.asReadonly();
  readonly accessToken = this.tokenSignal.asReadonly();
  readonly refreshToken = this.refreshTokenSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly isAuthenticated = computed(
    () => this.userSignal() !== null && this.tokenSignal() !== null,
  );

  constructor() {
    this.restoreSession();
  }

  async login(payload: LoginPayload): Promise<boolean> {
    if (this.loadingSignal()) {
      return false;
    }

    this.setLoading(true);
    this.clearError();
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, payload, {
          context: new HttpContext().set(SKIP_AUTH_REFRESH, true),
        }),
      );
      this.persistSession(response);
      await this.router.navigate(['/budget']);
      return true;
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de vous connecter.'));
      return false;
    } finally {
      this.setLoading(false);
    }
  }

  async register(payload: RegisterPayload): Promise<boolean> {
    if (this.loadingSignal()) {
      return false;
    }

    this.setLoading(true);
    this.clearError();
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, payload, {
          context: new HttpContext().set(SKIP_AUTH_REFRESH, true),
        }),
      );
      this.persistSession(response);
      await this.router.navigate(['/budget']);
      return true;
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de créer ce compte.'));
      return false;
    } finally {
      this.setLoading(false);
    }
  }

  async refreshProfile(): Promise<void> {
    if (!this.tokenSignal()) {
      return;
    }

    try {
      const user = await firstValueFrom(
        this.http.get<AuthUser>(`${this.apiBaseUrl}/auth/me`, {
          context: new HttpContext().set(SKIP_AUTH_REFRESH, true),
        }),
      );
      const normalizedUser = this.normalizeUser(user);
      this.userSignal.set(normalizedUser);
      const accessToken = this.tokenSignal();
      const refreshToken = this.refreshTokenSignal();
      if (accessToken && refreshToken) {
        this.saveSession({ accessToken, refreshToken, user: normalizedUser });
      }
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.logout(true);
      } else {
        console.warn('Failed to refresh profile', error);
      }
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.refreshTokenSignal();
    if (!refreshToken) {
      return false;
    }

    const request = firstValueFrom(
      this.http.post<AuthResponse>(
        `${this.apiBaseUrl}/auth/refresh`,
        { refreshToken },
        { context: new HttpContext().set(SKIP_AUTH_REFRESH, true) },
      ),
    )
      .then((response) => {
        this.persistSession(response);
        return true;
      })
      .catch(() => {
      this.errorSignal.set('Votre session a expiré. Veuillez vous reconnecter.');
      return false;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    this.refreshPromise = request;
    return this.refreshPromise;
  }

  logout(silent = false): void {
    this.userSignal.set(null);
    this.tokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.refreshPromise = null;
    this.clearError();
    localStorage.removeItem(STORAGE_KEY);

    if (!silent) {
      void this.router.navigate(['/login']);
    }
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private restoreSession(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as StoredSession;
      if (parsed?.accessToken && parsed?.refreshToken && parsed?.user) {
        this.saveSession(parsed);
        this.scheduleProfileRefresh();
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private persistSession(response: AuthResponse): void {
    this.saveSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
    });
    this.scheduleProfileRefresh();
  }

  private saveSession(session: StoredSession): void {
    const normalizedUser = this.normalizeUser(session.user);
    this.userSignal.set(normalizedUser);
    this.tokenSignal.set(session.accessToken);
    this.refreshTokenSignal.set(session.refreshToken);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: normalizedUser,
      }),
    );
  }

  private scheduleProfileRefresh(): void {
    Promise.resolve().then(() => {
      void this.refreshProfile();
    });
  }

  private setLoading(value: boolean): void {
    this.loadingSignal.set(value);
  }

  private mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.extractBackendMessage(error.error);
      switch (error.status) {
        case 400:
          return backendMessage ?? 'Les données envoyées sont invalides.';
        case 401:
          return backendMessage ?? 'Email ou mot de passe invalide.';
        case 403:
          return backendMessage ?? "Vous n'êtes pas autorisé à effectuer cette action.";
        case 404:
          return backendMessage ?? 'Ressource introuvable.';
        case 409:
          return backendMessage ?? 'Cette adresse email est déjà utilisée.';
        case 500:
          return backendMessage ?? 'Une erreur serveur est survenue.';
        default:
          return backendMessage ?? fallback;
      }
    }
    return fallback;
  }

  private extractBackendMessage(payload: unknown): string | null {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object') {
      const maybeMessage = (payload as { message?: unknown; error?: unknown }).message;
      if (Array.isArray(maybeMessage) && maybeMessage.length > 0) {
        return maybeMessage.join(' ');
      }
      if (typeof maybeMessage === 'string') {
        return maybeMessage;
      }
      const maybeError = (payload as { error?: unknown }).error;
      if (typeof maybeError === 'string') {
        return maybeError;
      }
    }

    return null;
  }

  private normalizeUser(user: AuthUser): AuthUser {
    const currency = (user as AuthUser & { settings?: { currency?: string } }).settings?.currency ?? 'EUR';
    return {
      ...user,
      settings: {
        currency,
      },
    };
  }
}
