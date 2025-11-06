import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthStore } from './auth.store';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthResponse } from './auth.models';

describe('AuthStore', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let storage: Record<string, string>;
  let mockedLocalStorage: Storage;
  let originalLocalStorageDescriptor: PropertyDescriptor | undefined;

  const apiUrl = 'https://api.test';
  const sessionPayload: AuthResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'John Doe',
      settings: { currency: 'USD' },
    },
  };

  beforeEach(() => {
    storage = {};

    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    mockedLocalStorage = {
      getItem: jest.fn((key: string) => storage[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete storage[key];
      }),
      clear: jest.fn(() => {
        storage = {};
      }),
      key: jest.fn(),
      length: 0,
    } as unknown as Storage;

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: mockedLocalStorage,
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        AuthStore,
        { provide: API_BASE_URL, useValue: apiUrl },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
    }
  });

  it('logs in successfully and persists session', async () => {
    const store = TestBed.inject(AuthStore);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();

    const loginPromise = store.login({ email: 'user@example.com', password: 'secret' });

    const req = httpMock.expectOne(`${apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com', password: 'secret' });
    req.flush(sessionPayload);

    await loginPromise;
    await Promise.resolve(); // allow scheduled refresh to run

    expect(store.accessToken()).toBe('access-token');
    expect(store.user()?.settings.currency).toBe('USD');
    expect(navigateSpy).toHaveBeenCalledWith(['/budget']);
    expect(storage['le-budget:auth']).toBeDefined();
    expect(refreshProfileSpy).toHaveBeenCalled();
    navigateSpy.mockRestore();
    refreshProfileSpy.mockRestore();
  });

  it('registers a new user and persists the session', async () => {
    const store = TestBed.inject(AuthStore);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();

    const registerPromise = store.register({
      email: 'new@example.com',
      password: 'secret',
      displayName: 'Newbie',
    });

    const req = httpMock.expectOne(`${apiUrl}/auth/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'new@example.com',
      password: 'secret',
      displayName: 'Newbie',
    });
    const newSession = {
      ...sessionPayload,
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
    };
    req.flush(newSession);

    await registerPromise;
    await Promise.resolve();

    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('fresh-access');
    expect(storage['le-budget:auth']).toBeDefined();
    navigateSpy.mockRestore();
    refreshProfileSpy.mockRestore();
  });

  it('prevents duplicate register submissions while loading', async () => {
    const store = TestBed.inject(AuthStore);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();

    const firstAttempt = store.register({ email: 'dup@example.com', password: 'secret' });
    const secondAttempt = store.register({ email: 'dup@example.com', password: 'secret' });

    await expect(secondAttempt).resolves.toBe(false);

    const requests = httpMock.match(`${apiUrl}/auth/register`);
    expect(requests).toHaveLength(1);
    requests[0].flush(sessionPayload);
    await firstAttempt;
    refreshProfileSpy.mockRestore();
  });

  it('maps register conflicts to a friendly error message', async () => {
    const store = TestBed.inject(AuthStore);
    const registerPromise = store.register({ email: 'dup@example.com', password: 'secret' });

    const req = httpMock.expectOne(`${apiUrl}/auth/register`);
    req.flush({}, { status: 409, statusText: 'Conflict' });

    await expect(registerPromise).resolves.toBe(false);
    expect(store.error()).toBe('Cette adresse email est déjà utilisée.');
  });

  it('maps backend errors when login fails', async () => {
    const store = TestBed.inject(AuthStore);
    const loginPromise = store.login({ email: 'user@example.com', password: 'bad' });

    const req = httpMock.expectOne(`${apiUrl}/auth/login`);
    req.flush({ message: 'Identifiants invalides' }, { status: 401, statusText: 'Unauthorized' });

    await expect(loginPromise).resolves.toBe(false);
    expect(store.error()).toBe('Identifiants invalides');
    expect(store.loading()).toBe(false);
  });

  it('restores session from storage and normalizes user currency', async () => {
    storage['le-budget:auth'] = JSON.stringify({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      user: {
        id: 'user-2',
        email: 'other@example.com',
        displayName: null,
        settings: {},
      },
    });

    const store = TestBed.inject(AuthStore);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();

    await Promise.resolve();

    expect(store.accessToken()).toBe('stored-access');
    expect(store.refreshToken()).toBe('stored-refresh');
    expect(store.user()?.settings.currency).toBe('EUR'); // default applied
    expect(refreshProfileSpy).toHaveBeenCalled();
    refreshProfileSpy.mockRestore();
  });

  it('clears state and navigates on logout', async () => {
    const store = TestBed.inject(AuthStore);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();

    // populate session
    const loginPromise = store.login({ email: 'user@example.com', password: 'secret' });
    httpMock.expectOne(`${apiUrl}/auth/login`).flush(sessionPayload);
    await loginPromise;
    await Promise.resolve();

    store.logout();

    expect(store.user()).toBeNull();
    expect(store.accessToken()).toBeNull();
    expect(storage['le-budget:auth']).toBeUndefined();
    expect(navigateSpy).toHaveBeenLastCalledWith(['/login']);
    navigateSpy.mockRestore();
    refreshProfileSpy.mockRestore();
  });

  it('handles refresh token failures gracefully', async () => {
    // set existing session
    storage['le-budget:auth'] = JSON.stringify({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      user: sessionPayload.user,
    });
    const store = TestBed.inject(AuthStore);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();
    await Promise.resolve();

    const refreshPromise = store.refreshAccessToken();
    const req = httpMock.expectOne(`${apiUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'stored-refresh' });
    req.flush({ message: 'Expired' }, { status: 401, statusText: 'Unauthorized' });

    await expect(refreshPromise).resolves.toBe(false);
    expect(store.error()).toBe('Votre session a expiré. Veuillez vous reconnecter.');
    refreshProfileSpy.mockRestore();
  });

  it('refreshes the access token and persists the new session', async () => {
    storage['le-budget:auth'] = JSON.stringify(sessionPayload);
    const store = TestBed.inject(AuthStore);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();
    await Promise.resolve();

    const refreshPromise = store.refreshAccessToken();
    const req = httpMock.expectOne(`${apiUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-token' });
    const refreshed = {
      ...sessionPayload,
      accessToken: 'renewed-access',
      refreshToken: 'renewed-refresh',
    };
    req.flush(refreshed);

    await expect(refreshPromise).resolves.toBe(true);
    expect(store.accessToken()).toBe('renewed-access');
    expect(JSON.parse(storage['le-budget:auth']).accessToken).toBe('renewed-access');
    refreshProfileSpy.mockRestore();
  });

  it('shares the in-flight refresh promise', async () => {
    storage['le-budget:auth'] = JSON.stringify(sessionPayload);
    const store = TestBed.inject(AuthStore);
    const refreshProfileSpy = jest.spyOn(store, 'refreshProfile').mockResolvedValue();
    await Promise.resolve();

    const first = store.refreshAccessToken();
    const second = store.refreshAccessToken();
    const requests = httpMock.match(`${apiUrl}/auth/refresh`);
    expect(requests).toHaveLength(1);
    requests[0].flush(sessionPayload);

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    refreshProfileSpy.mockRestore();
  });

  it('refreshes the profile and saves normalized user data', async () => {
    const store = TestBed.inject(AuthStore);
    (store as unknown as { tokenSignal: { set(value: string): void } }).tokenSignal.set('token');
    (store as unknown as { refreshTokenSignal: { set(value: string): void } }).refreshTokenSignal.set(
      'refresh',
    );
    const saveSpy = jest.spyOn(store as unknown as { saveSession(session: unknown): void }, 'saveSession');

    const profilePromise = store.refreshProfile();
    const req = httpMock.expectOne(`${apiUrl}/auth/me`);
    req.flush({
      ...sessionPayload.user,
      settings: {} as unknown as { currency: string },
    });

    await profilePromise;
    expect(store.user()?.settings.currency).toBe('EUR');
    expect(saveSpy).toHaveBeenCalled();
    saveSpy.mockRestore();
  });

  it('skips profile refresh when not authenticated', async () => {
    const store = TestBed.inject(AuthStore);
    await store.refreshProfile();
    httpMock.expectNone(`${apiUrl}/auth/me`);
    expect(store.user()).toBeNull();
  });

  it('logs out silently when refreshing profile returns 401', async () => {
    const store = TestBed.inject(AuthStore);

    (store as unknown as { tokenSignal: { set(value: string): void } }).tokenSignal.set('token');

    const logoutSpy = jest.spyOn(store, 'logout');

    const profilePromise = store.refreshProfile();
    const req = httpMock.expectOne(`${apiUrl}/auth/me`);
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    await profilePromise;
    expect(logoutSpy).toHaveBeenCalledWith(true);
    logoutSpy.mockRestore();
  });

  it('removes invalid stored sessions during bootstrap', () => {
    storage['le-budget:auth'] = '{invalid';
    const store = TestBed.inject(AuthStore);
    expect(store.accessToken()).toBeNull();
    expect(mockedLocalStorage.removeItem).toHaveBeenCalledWith('le-budget:auth');
  });

  it('does not navigate when logout is silent', async () => {
    const store = TestBed.inject(AuthStore);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    store.logout(true);

    expect(navigateSpy).not.toHaveBeenCalled();
    navigateSpy.mockRestore();
  });

  it('maps validation errors into readable messages', async () => {
    const store = TestBed.inject(AuthStore);
    const loginPromise = store.login({ email: 'user@example.com', password: 'bad' });

    const req = httpMock.expectOne(`${apiUrl}/auth/login`);
    req.flush(
      { message: ['Email invalide', 'Mot de passe trop court'] },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(loginPromise).resolves.toBe(false);
    expect(store.error()).toBe('Email invalide Mot de passe trop court');
  });

  it('short-circuits login when already loading', async () => {
    const store = TestBed.inject(AuthStore);
    (store as unknown as { loadingSignal: { set(value: boolean): void } }).loadingSignal.set(true);

    await expect(store.login({ email: 'user@example.com', password: 'secret' })).resolves.toBe(false);
    httpMock.expectNone(`${apiUrl}/auth/login`);

    (store as unknown as { loadingSignal: { set(value: boolean): void } }).loadingSignal.set(false);
  });

  it('warns when refresh profile fails with non-auth error', async () => {
    const store = TestBed.inject(AuthStore);
    (store as unknown as { tokenSignal: { set(value: string | null): void } }).tokenSignal.set('token');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const promise = store.refreshProfile();
    const req = httpMock.expectOne(`${apiUrl}/auth/me`);
    req.flush({ message: 'Maintenance' }, { status: 500, statusText: 'Server Error' });

    await promise;
    expect(warnSpy).toHaveBeenCalledWith('Failed to refresh profile', expect.any(HttpErrorResponse));
    warnSpy.mockRestore();
  });

  it('returns false when refresh token is missing', async () => {
    const store = TestBed.inject(AuthStore);
    (store as unknown as { refreshTokenSignal: { set(value: string | null): void } }).refreshTokenSignal.set(null);

    await expect(store.refreshAccessToken()).resolves.toBe(false);
    httpMock.expectNone(`${apiUrl}/auth/refresh`);
  });

  it('maps assorted HTTP errors via mapError helper', () => {
    const store = TestBed.inject(AuthStore) as unknown as {
      mapError(error: unknown, fallback: string): string;
    };

    const forbidden = new HttpErrorResponse({ status: 403, error: {} });
    expect(store.mapError(forbidden, 'fallback')).toBe("Vous n'êtes pas autorisé à effectuer cette action.");

    const notFound = new HttpErrorResponse({ status: 404, error: null });
    expect(store.mapError(notFound, 'fallback')).toBe('Ressource introuvable.');

    const server = new HttpErrorResponse({ status: 500, error: 'Serveur' });
    expect(store.mapError(server, 'fallback')).toBe('Serveur');

    const fallback = new HttpErrorResponse({ status: 418, error: null as unknown });
    expect(store.mapError(fallback, 'fallback message')).toBe('fallback message');
  });

  it('extracts backend messages from various payload shapes', () => {
    const store = TestBed.inject(AuthStore) as unknown as {
      extractBackendMessage(payload: unknown): string | null;
    };

    expect(store.extractBackendMessage(null)).toBeNull();
    expect(store.extractBackendMessage('Plain')).toBe('Plain');
    expect(store.extractBackendMessage({ message: ['One', 'Two'] })).toBe('One Two');
    expect(store.extractBackendMessage({ message: 'Single' })).toBe('Single');
    expect(store.extractBackendMessage({ error: 'Problem' })).toBe('Problem');
    expect(store.extractBackendMessage({})).toBeNull();
  });
});
