import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AccountsStore } from './accounts.store';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthStore } from '../auth/auth.store';
import { EventsGateway } from '../events/events.service';
import { Account } from './accounts.models';

type SignalSetter<T> = {
  set(value: T): void;
};

type AccountsStoreHarness = AccountsStore & {
  accountsSignal: SignalSetter<Account[]>;
  loadingSignal: SignalSetter<boolean>;
  errorSignal: SignalSetter<string | null>;
  mutationErrorSignal: SignalSetter<string | null>;
  mutationLoadingSignal: SignalSetter<boolean>;
  applyAccountUpdate(payload: Partial<Account>): void;
  normalizeCurrency(value: string | null): string;
  toAccountType(value: string | null): Account['type'];
  toNumber(value: unknown): number;
  toIsoString(value: unknown): string | null;
  mapError(error: unknown, fallback: string): string;
  extractBackendMessage(payload: unknown): string | null;
};

type AuthUserStub = {
  id: string;
  email: string;
  displayName: string | null;
  settings: { currency: string };
};

class AuthStoreStub {
  private readonly userSignal = signal<AuthUserStub | null>({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    settings: { currency: 'usd' },
  });

  user() {
    return this.userSignal();
  }

  setCurrency(currency: string | null) {
    this.userSignal.set(
      currency
        ? { id: 'user-1', email: 'user@example.com', displayName: 'User', settings: { currency } }
        : null,
    );
  }
}

class EventsGatewayStub {
  private readonly listeners = new Map<string, (payload: unknown) => void>();

  on(event: string, callback: (payload: unknown) => void): () => void {
    this.listeners.set(event, callback);
    return () => this.listeners.delete(event);
  }

  emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.(payload);
  }
}

const apiUrl = 'https://api.test';

const toAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  name: 'Compte',
  type: 'CHECKING',
  currency: 'EUR',
  initialBalance: 0,
  currentBalance: 0,
  reconciledBalance: 0,
  pointedBalance: 0,
  archived: false,
  createdAt: '2024-03-01T00:00:00Z',
  updatedAt: '2024-03-01T01:00:00Z',
  ...overrides,
});

const accountResponse = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'acc-1',
  name: 'Compte',
  type: 'CHECKING',
  currency: 'usd',
  initialBalance: '10',
  currentBalance: '15',
  reconciledBalance: '12',
  pointedBalance: '11',
  archived: false,
  createdAt: '2024-03-01T00:00:00Z',
  updatedAt: '2024-03-01T01:00:00Z',
  ...overrides,
});

describe('AccountsStore', () => {
  let store: AccountsStore;
  let httpMock: HttpTestingController;
  let authStore: AuthStoreStub;
  let events: EventsGatewayStub;
  const getHarness = () => store as unknown as AccountsStoreHarness;

  beforeEach(() => {
    authStore = new AuthStoreStub();
    events = new EventsGatewayStub();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AccountsStore,
        { provide: API_BASE_URL, useValue: apiUrl },
        { provide: AuthStore, useValue: authStore },
        { provide: EventsGateway, useValue: events },
      ],
    });

    store = TestBed.inject(AccountsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads accounts and computes totals', async () => {
    const loadPromise = store.loadAccounts();
    httpMock.expectOne(`${apiUrl}/accounts`).flush([
      accountResponse({ id: 'acc-2', name: 'B account', createdAt: '2024-03-02T00:00:00Z', currentBalance: '5' }),
      accountResponse({ id: 'acc-1', name: 'A account', createdAt: '2024-03-01T00:00:00Z', currency: 'eur' }),
    ]);

    await loadPromise;

    expect(store.accounts().map((acc) => acc.name)).toEqual(['A account', 'B account']);
    expect(store.totals()).toEqual({ currentBalance: 20, reconciledBalance: 24 });
    expect(store.hasData()).toBe(true);
  });

  it('skips loading when data already present and not forced', async () => {
    getHarness().accountsSignal.set([toAccount({ id: 'seed' })]);

    await store.loadAccounts();
    httpMock.expectNone(`${apiUrl}/accounts`);
    expect(store.accounts()[0]?.id).toBe('seed');
  });

  it('does not fetch again while already loading', async () => {
    getHarness().loadingSignal.set(true);

    await store.loadAccounts();
    httpMock.expectNone(`${apiUrl}/accounts`);
    expect(store.loading()).toBe(true);
    getHarness().loadingSignal.set(false);
  });

  it('reload forces a network request', async () => {
    const loadSpy = jest.spyOn(store, 'loadAccounts').mockResolvedValue(undefined);

    await store.reload();

    expect(loadSpy).toHaveBeenCalledWith(true);
    loadSpy.mockRestore();
  });

  it('maps errors on load failure', async () => {
    const loadPromise = store.loadAccounts(true);
    httpMock.expectOne(`${apiUrl}/accounts`).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(loadPromise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.error()).toBe('Forbidden');
    expect(store.accounts()).toEqual([]);
  });

  it('creates an account using default currency', async () => {
    authStore.setCurrency('gbp');
    const createPromise = store.createAccount({ name: 'New', type: 'CHECKING', initialBalance: 10 });

    const req = httpMock.expectOne(`${apiUrl}/accounts`);
    expect(req.request.body.currency).toBe('GBP');
    req.flush(accountResponse({ id: 'acc-3', name: 'New', currency: 'gbp', createdAt: '2024-03-03T00:00:00Z' }));

    const created = await createPromise;
    expect(created.name).toBe('New');
    expect(store.accounts().some((acc) => acc.id === 'acc-3')).toBe(true);
  });

  it('stores save error when creation fails', async () => {
    const createPromise = store.createAccount({ name: 'Duplicate', type: 'CHECKING' });
    httpMock.expectOne(`${apiUrl}/accounts`).flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });

    await expect(createPromise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.saveError()).toBe('Conflict');
  });

  it('updates accounts and resorts list', async () => {
    getHarness().accountsSignal.set([
      toAccount({ id: 'acc-2', name: 'Second', createdAt: '2024-03-02T00:00:00Z' }),
      toAccount({ id: 'acc-1', name: 'First', createdAt: '2024-03-01T00:00:00Z' }),
    ]);

    const updatePromise = store.updateAccount('acc-1', { name: 'Updated', type: 'CASH' });
    httpMock.expectOne(`${apiUrl}/accounts/acc-1`).flush(accountResponse({ id: 'acc-1', name: 'Updated', type: 'CASH' }));

    const updated = await updatePromise;
    expect(updated.type).toBe('CASH');
    expect(store.accounts()[0].name).toBe('Updated');
  });

  it('refreshes existing accounts and removes missing ones', async () => {
    getHarness().accountsSignal.set([toAccount({ id: 'acc-1' })]);

    const first = store.refreshAccount('acc-1');
    httpMock.expectOne(`${apiUrl}/accounts/acc-1`).flush(accountResponse({ name: 'Refreshed' }));
    await first;
    expect(store.accounts()[0].name).toBe('Refreshed');

    const second = store.refreshAccount('acc-1');
    httpMock.expectOne(`${apiUrl}/accounts/acc-1`).flush({}, { status: 404, statusText: 'Not Found' });
    await second;
    expect(store.accounts()).toEqual([]);
  });

  it('ignores refresh requests without an id', async () => {
    await store.refreshAccount('');
    httpMock.expectNone(`${apiUrl}/accounts/`);
    expect(store.accounts()).toEqual([]);
  });

  it('warns when refresh fails unexpectedly', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const refresh = store.refreshAccount('acc-2');
    httpMock.expectOne(`${apiUrl}/accounts/acc-2`).flush({}, { status: 500, statusText: 'Server Error' });

    await refresh;
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('applies updates received via events', () => {
    events.emit('account.created', accountResponse({ id: 'ev-1', name: 'Event' }));
    expect(store.accounts()[0].id).toBe('ev-1');

    events.emit('account.updated', accountResponse({ id: 'ev-1', name: 'Event Updated' }));
    expect(store.accounts()[0].name).toBe('Event Updated');
    events.emit('account.archived', accountResponse({ id: 'ev-1', archived: true }));
    expect(store.accounts()[0].archived).toBe(true);
  });

  it('ignores malformed event payloads', () => {
    const storeHarness = getHarness();
    storeHarness.accountsSignal.set([toAccount({ id: 'known' })]);
    storeHarness.applyAccountUpdate({});
    expect(store.accounts()[0].id).toBe('known');
  });

  it('normalizes helper outputs and maps fallback errors', () => {
    const storeHarness = getHarness();
    expect(storeHarness.normalizeCurrency('usd')).toBe('USD');
    expect(storeHarness.normalizeCurrency(null)).toBe('EUR');
    expect(storeHarness.normalizeCurrency('longcode')).toBe('LON');
    expect(storeHarness.toAccountType('credit_card')).toBe('CREDIT_CARD');
    expect(storeHarness.toAccountType('custom')).toBe('OTHER');
    expect(storeHarness.toAccountType(null)).toBe('CHECKING');
    expect(storeHarness.toNumber('12')).toBe(12);
    expect(storeHarness.toNumber(5)).toBe(5);
    expect(storeHarness.toNumber('oops')).toBe(0);
    expect(storeHarness.toIsoString('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00.000Z');
    expect(storeHarness.toIsoString('invalid')).toBeNull();
    expect(storeHarness.toIsoString(new Date('2024-02-01T00:00:00Z'))).toBe('2024-02-01T00:00:00.000Z');

    const error = new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request',
      error: { message: ['Invalid'], error: 'Ignored' },
    });
    const storeHarness = getHarness();
    expect(storeHarness.mapError(error, 'fallback')).toBe('Invalid');
    expect(storeHarness.extractBackendMessage({ error: 'Error message' })).toBe('Error message');
    expect(storeHarness.mapError(new HttpErrorResponse({ status: 500, error: null }), 'fallback')).toBe(
      'Erreur interne du serveur.',
    );
    expect(storeHarness.mapError(new Error('boom'), 'fallback')).toBe('fallback');
  });

  it('resets account state and errors', () => {
    const storeHarness = getHarness();
    storeHarness.accountsSignal.set([toAccount()]);
    storeHarness.loadingSignal.set(true);
    storeHarness.errorSignal.set('Oops');

    store.reset();

    expect(store.accounts()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('clears read and write errors separately', () => {
    const storeHarness = getHarness();
    storeHarness.errorSignal.set('Oops');
    storeHarness.mutationErrorSignal.set('Mutation');

    store.clearError();
    store.clearSaveError();

    expect(store.error()).toBeNull();
    expect(store.saveError()).toBeNull();
  });

  it('exposes user default currency', () => {
    expect(store.getDefaultCurrency()).toBe('usd');
    authStore.setCurrency('cad');
    expect(store.getDefaultCurrency()).toBe('cad');
    authStore.setCurrency(null);
    expect(store.getDefaultCurrency()).toBe('EUR');
  });

  it('prevents concurrent account creation', async () => {
    getHarness().mutationLoadingSignal.set(true);
    await expect(store.createAccount({ name: 'Dup', type: 'CHECKING' })).rejects.toThrow(
      'Une création est déjà en cours.',
    );
    getHarness().mutationLoadingSignal.set(false);
  });

  it('prevents concurrent account updates', async () => {
    getHarness().mutationLoadingSignal.set(true);
    await expect(store.updateAccount('acc-1', { name: 'Test' })).rejects.toThrow(
      'Une opération est déjà en cours.',
    );
    getHarness().mutationLoadingSignal.set(false);
  });

  it('stores mutation error when update fails', async () => {
    getHarness().mutationLoadingSignal.set(false);
    const updatePromise = store.updateAccount('acc-1', { name: 'Fail' });
    httpMock.expectOne(`${apiUrl}/accounts/acc-1`).flush({}, { status: 403, statusText: 'Forbidden' });

    await expect(updatePromise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.saveError()).toBe("Vous n'avez pas accès à ces comptes.");
  });
});
