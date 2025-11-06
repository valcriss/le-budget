import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TransactionsStore } from './transactions.store';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AccountsStore } from '../accounts/accounts.store';
import { Transaction } from './transactions.models';

type SignalSetter<T> = {
  set(value: T): void;
};

type TransactionsStateSnapshot = {
  accountId: string | null;
  items: Transaction[];
  meta: { total: number; skip: number; take: number };
};

type TransactionsStoreHarness = TransactionsStore & {
  stateSignal: SignalSetter<TransactionsStateSnapshot>;
  loadingSignal: SignalSetter<boolean>;
  errorSignal: SignalSetter<string | null>;
  buildQueryParams(params: {
    skip?: number;
    take?: number;
    search?: string;
    order?: string;
    status?: string;
  }): HttpParams;
  extractBackendMessage(payload: unknown): string | null;
};

describe('TransactionsStore', () => {
  let store: TransactionsStore;
  let httpMock: HttpTestingController;
  let accountsStore: { refreshAccount: jest.Mock };
  const harness = () => store as unknown as TransactionsStoreHarness;

  const apiUrl = 'https://api.test';
  const accountId = 'account-1';

  const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'tx-1',
    accountId,
    date: '2024-03-01',
    label: 'Transaction',
    categoryId: null,
    categoryName: null,
    amount: 10,
    balance: 100,
    status: 'NONE',
    transactionType: 'NONE',
    linkedTransactionId: null,
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    accountsStore = {
      refreshAccount: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TransactionsStore,
        { provide: API_BASE_URL, useValue: apiUrl },
        { provide: AccountsStore, useValue: accountsStore },
      ],
    });

    store = TestBed.inject(TransactionsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads transactions and sorts them by date then creation time', async () => {
    const loadPromise = store.load(accountId, { skip: 10, search: 'Rent' });

    const req = httpMock.expectOne((request) => request.url === `${apiUrl}/accounts/${accountId}/transactions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('skip')).toBe('10');
    expect(req.request.params.get('search')).toBe('Rent');

    const items = [
      createTransaction({ id: 'tx-b', date: '2024-02-01', createdAt: '2024-02-01T12:00:00Z' }),
      createTransaction({ id: 'tx-a', date: '2024-03-01', createdAt: '2024-03-01T09:00:00Z' }),
      createTransaction({ id: 'tx-c', date: '2024-03-01', createdAt: '2024-03-01T11:00:00Z' }),
    ];

    req.flush({
      items,
      meta: { total: 3, skip: 10, take: 50 },
    });

    await loadPromise;

    expect(store.transactions().map((t) => t.id)).toEqual(['tx-c', 'tx-a', 'tx-b']);
    expect(store.meta().total).toBe(3);
    expect(store.loading()).toBe(false);
  });

  it('resets state when account id is missing', async () => {
    await store.load('');
    httpMock.expectNone((_request) => true);

    expect(store.transactions()).toEqual([]);
    expect(store.meta().total).toBe(0);
  });

  it('sets error when load fails', async () => {
    const loadPromise = store.load(accountId);
    const req = httpMock.expectOne(`${apiUrl}/accounts/${accountId}/transactions`);
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(loadPromise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.error()).toBe('Forbidden');
    expect(store.loading()).toBe(false);
  });

  it('updates a transaction and refreshes the account', async () => {
    // seed initial state
    const initialItems = [createTransaction({ id: 'tx-1' }), createTransaction({ id: 'tx-2', date: '2024-02-10' })];
    harness().stateSignal.set({
      accountId,
      items: initialItems,
      meta: { total: 2, skip: 0, take: 50 },
    });

    const updatePromise = store.update(accountId, 'tx-1', { label: 'Updated' });
    const req = httpMock.expectOne(`${apiUrl}/accounts/${accountId}/transactions/tx-1`);
    expect(req.request.method).toBe('PATCH');
    req.flush(createTransaction({ id: 'tx-1', label: 'Updated', date: '2024-03-05' }));

    await updatePromise;

    expect(store.transactions()[0]?.label).toBe('Updated');
    expect(accountsStore.refreshAccount).toHaveBeenCalledWith(accountId);
    expect(store.loading()).toBe(false);
  });

  it('returns null when update fails', async () => {
    const updatePromise = store.update(accountId, 'tx-1', { label: 'Updated' });
    const req = httpMock.expectOne(`${apiUrl}/accounts/${accountId}/transactions/tx-1`);
    req.flush({ message: 'Missing' }, { status: 404, statusText: 'Not Found' });

    await expect(updatePromise).resolves.toBeNull();
    expect(store.error()).toBe('Missing');
  });

  it('ignores update result when state belongs to another account', async () => {
    const foreignItems = [createTransaction({ id: 'tx-keep', label: 'Keep me' })];
    harness().stateSignal.set({
      accountId: 'other-account',
      items: foreignItems,
      meta: { total: 1, skip: 0, take: 50 },
    });

    const updatePromise = store.update(accountId, 'tx-keep', { label: 'Updated' });
    const req = httpMock.expectOne(`${apiUrl}/accounts/${accountId}/transactions/tx-keep`);
    req.flush(createTransaction({ id: 'tx-keep', label: 'Updated' }));

    await updatePromise;

    expect(store.transactions()[0]?.label).toBe('Keep me');
    expect(accountsStore.refreshAccount).toHaveBeenCalledWith(accountId);
  });

  it('creates a transaction and increments total', async () => {
    harness().stateSignal.set({
      accountId,
      items: [createTransaction({ id: 'existing', date: '2024-01-01' })],
      meta: { total: 1, skip: 0, take: 50 },
    });

    const createPromise = store.create(accountId, { date: '2024-04-01', label: 'New', amount: 50 });
    const req = httpMock.expectOne(`${apiUrl}/accounts/${accountId}/transactions`);
    expect(req.request.method).toBe('POST');
    req.flush(createTransaction({ id: 'new', date: '2024-04-01', amount: 50, createdAt: '2024-04-01T00:00:00Z' }));

    await createPromise;

    expect(store.transactions()[0]?.id).toBe('new');
    expect(store.meta().total).toBe(2);
    expect(accountsStore.refreshAccount).toHaveBeenCalledWith(accountId);
  });

  it('returns null when create fails', async () => {
    const createPromise = store.create(accountId, { date: '2024-04-01', label: 'New', amount: 50 });
    const req = httpMock.expectOne(`${apiUrl}/accounts/${accountId}/transactions`);
    req.flush({ message: 'Error' }, { status: 500, statusText: 'Server Error' });

    await expect(createPromise).resolves.toBeNull();
    expect(store.error()).toBe('Error');
  });

  it('ignores created transaction when state belongs to another account', async () => {
    harness().stateSignal.set({
      accountId: 'other-account',
      items: [createTransaction({ id: 'existing', date: '2024-01-01' })],
      meta: { total: 1, skip: 0, take: 50 },
    });

    const createPromise = store.create(accountId, { date: '2024-04-01', label: 'New', amount: 50 });
    const req = httpMock.expectOne(`${apiUrl}/accounts/${accountId}/transactions`);
    req.flush(createTransaction({ id: 'new', date: '2024-04-01' }));

    await createPromise;

    expect(store.transactions().map((item) => item.id)).toEqual(['existing']);
  });

  it('resets store state', () => {
    harness().stateSignal.set({
      accountId,
      items: [createTransaction()],
      meta: { total: 1, skip: 0, take: 50 },
    });
    harness().loadingSignal.set(true);
    harness().errorSignal.set('message');

    store.reset();

    expect(store.transactions()).toEqual([]);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('builds query params while skipping empty values', () => {
    const params = harness().buildQueryParams({
      skip: 0,
      take: undefined,
      from: null,
      to: '',
      search: 'Rent',
      status: 'NONE',
    });

    expect(params.get('skip')).toBe('0');
    expect(params.get('search')).toBe('Rent');
    expect(params.get('status')).toBe('NONE');
    expect(params.has('to')).toBe(false);
    expect(params.has('take')).toBe(false);
  });

  describe('mapError', () => {
    const mapError = (error: unknown, fallback = 'fallback message') =>
      (store as unknown as { mapError(e: unknown, fallback: string): string }).mapError(error, fallback);

    it.each([
      [400, undefined, 'La requête est invalide.'],
      [401, undefined, 'Authentification requise.'],
      [403, undefined, "Vous n'êtes pas autorisé à effectuer cette action."],
      [404, undefined, 'Transaction introuvable.'],
      [409, undefined, 'Conflit lors de la mise à jour.'],
      [500, undefined, 'Une erreur serveur est survenue.'],
    ])('returns default message for HTTP %s when backend message missing', (status, payload, expected) => {
      const message = mapError(new HttpErrorResponse({ status, error: payload }));
      expect(message).toBe(expected);
    });

    it('prefers backend message arrays', () => {
      const message = mapError(
        new HttpErrorResponse({ status: 400, error: { message: ['First', 'Second'] } }),
      );
      expect(message).toBe('First Second');
    });

    it('prefers backend message strings', () => {
      const message = mapError(new HttpErrorResponse({ status: 400, error: { message: 'Single' } }));
      expect(message).toBe('Single');
    });

    it('prefers backend error field', () => {
      const message = mapError(new HttpErrorResponse({ status: 500, error: { error: 'Boom' } }));
      expect(message).toBe('Boom');
    });

    it('returns raw string payloads from backend', () => {
      const message = mapError(new HttpErrorResponse({ status: 500, error: 'Direct message' }));
      expect(message).toBe('Direct message');
    });

    it('ignores unknown payload shapes', () => {
      const message = mapError(
        new HttpErrorResponse({ status: 400, error: { detail: 'Not relevant' } }),
        'fallback',
      );
      expect(message).toBe('La requête est invalide.');
    });

    it('falls back when response status is unexpected', () => {
      const message = mapError(new HttpErrorResponse({ status: 418, error: null }), 'fallback');
      expect(message).toBe('fallback');
    });

    it('returns fallback for non HttpErrorResponse values', () => {
      const message = mapError(new Error('boom'), 'fallback');
      expect(message).toBe('fallback');
    });
  });

  it('extracts backend message from plain payloads', () => {
    const extract = harness().extractBackendMessage({ message: ['One', 'Two'] });
    expect(extract).toBe('One Two');
  });
});
