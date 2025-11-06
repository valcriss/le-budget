import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CategoriesStore } from './categories.store';
import { API_BASE_URL } from '../config/api-base-url.token';
import { Category } from './categories.models';

type SignalSetter<T> = {
  set(value: T): void;
};

type CategoriesStoreHarness = CategoriesStore & {
  loadedSignal: SignalSetter<boolean>;
  categoriesSignal: SignalSetter<Category[]>;
  loadingSignal: SignalSetter<boolean>;
  errorSignal: SignalSetter<string | null>;
  mapError(error: unknown, fallback: string): string;
  extractBackendMessage(payload: unknown): string | null;
};

const apiUrl = 'https://api.test';

const toCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  name: 'Logement',
  kind: 'EXPENSE',
  sortOrder: 1,
  parentCategoryId: null,
  linkedAccountId: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('CategoriesStore', () => {
  let store: CategoriesStore;
  let httpMock: HttpTestingController;
  const harness = () => store as unknown as CategoriesStoreHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CategoriesStore,
        { provide: API_BASE_URL, useValue: apiUrl },
      ],
    });

    store = TestBed.inject(CategoriesStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads categories, sorts them and marks store as loaded', async () => {
    const loadPromise = store.load();
    httpMock.expectOne(`${apiUrl}/categories`).flush([
      toCategory({ id: 'cat-2', name: 'B', sortOrder: 2 }),
      toCategory({ id: 'cat-1', name: 'A', sortOrder: 1 }),
    ]);

    await loadPromise;

    expect(store.categories().map((c) => c.id)).toEqual(['cat-1', 'cat-2']);
    expect(store.hasData()).toBe(true);
  });

  it('skips load when already loaded and not forced', async () => {
    const storeHarness = harness();
    storeHarness.loadedSignal.set(true);
    storeHarness.categoriesSignal.set([toCategory()]);

    await store.load();
    httpMock.expectNone(`${apiUrl}/categories`);
    expect(store.categories()).toHaveLength(1);
  });

  it('skips load when already loading', async () => {
    harness().loadingSignal.set(true);
    await store.load(true);
    httpMock.expectNone(`${apiUrl}/categories`);
    harness().loadingSignal.set(false);
    expect(store.loading()).toBe(false);
  });

  it('bubbles load errors via mapError', async () => {
    const promise = store.load(true);
    httpMock.expectOne(`${apiUrl}/categories`).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.error()).toBe('Forbidden');
  });

  it('ensures load is called only when needed', async () => {
    const spy = jest.spyOn(store, 'load').mockResolvedValue(undefined as unknown as void);

    await store.ensureLoaded();

    expect(spy).toHaveBeenCalledWith(false);
    spy.mockRestore();
  });

  it('creates categories and inserts them sorted', async () => {
    const createPromise = store.create({ name: 'New', kind: 'EXPENSE' });
    httpMock.expectOne(`${apiUrl}/categories`).flush(toCategory({ id: 'cat-3', name: 'New' }));

    const created = await createPromise;
    expect(created?.id).toBe('cat-3');
    expect(store.categories().some((c) => c.id === 'cat-3')).toBe(true);
  });

  it('returns null and sets error when creation fails', async () => {
    const createPromise = store.create({ name: 'Fail', kind: 'EXPENSE' });
    httpMock.expectOne(`${apiUrl}/categories`).flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });

    await expect(createPromise).resolves.toBeNull();
    expect(store.error()).toBe('Conflict');
  });

  it('updates categories and keeps order', async () => {
    harness().categoriesSignal.set([toCategory({ id: 'cat-1', name: 'Initial' })]);

    const updatePromise = store.update('cat-1', { name: 'Updated' });
    httpMock.expectOne(`${apiUrl}/categories/cat-1`).flush(toCategory({ id: 'cat-1', name: 'Updated' }));

    const updated = await updatePromise;
    expect(updated?.name).toBe('Updated');
    expect(store.categories()[0].name).toBe('Updated');
  });

  it('returns null and sets error when update fails', async () => {
    const updatePromise = store.update('cat-unknown', { name: 'Missing' });
    httpMock.expectOne(`${apiUrl}/categories/cat-unknown`).flush({ message: 'Missing' }, { status: 404, statusText: 'Not Found' });

    await expect(updatePromise).resolves.toBeNull();
    expect(store.error()).toBe('Missing');
  });

  it('removes categories successfully', async () => {
    harness().categoriesSignal.set([toCategory({ id: 'cat-1' })]);

    const removePromise = store.remove('cat-1');
    httpMock.expectOne(`${apiUrl}/categories/cat-1`).flush({});

    await expect(removePromise).resolves.toBe(true);
    expect(store.categories()).toEqual([]);
  });

  it('returns false and sets error when removal fails', async () => {
    const removePromise = store.remove('cat-1');
    httpMock.expectOne(`${apiUrl}/categories/cat-1`).flush({ message: 'Error' }, { status: 500, statusText: 'Server Error' });

    await expect(removePromise).resolves.toBe(false);
    expect(store.error()).toBe('Error');
  });

  it('clears error manually', () => {
    harness().errorSignal.set('err');
    store.clearError();
    expect(store.error()).toBeNull();
  });

  it('resets store state', () => {
    const storeHarness = harness();
    storeHarness.categoriesSignal.set([toCategory()]);
    storeHarness.loadedSignal.set(true);
    storeHarness.errorSignal.set('error');

    store.reset();

    expect(store.categories()).toEqual([]);
    expect(store.error()).toBeNull();
    expect(store.hasData()).toBe(false);
  });

  describe('mapError helpers', () => {
    it('maps HTTP status codes to friendly messages', () => {
      const mapError = harness().mapError.bind(store);
      expect(mapError(new HttpErrorResponse({ status: 400 }), 'fallback')).toBe('La requête est invalide.');
      expect(mapError(new HttpErrorResponse({ status: 401 }), 'fallback')).toBe('Authentification requise.');
      expect(mapError(new HttpErrorResponse({ status: 403 }), 'fallback')).toBe("Vous n'êtes pas autorisé à effectuer cette action.");
      expect(mapError(new HttpErrorResponse({ status: 404 }), 'fallback')).toBe('Catégorie introuvable.');
      expect(mapError(new HttpErrorResponse({ status: 409 }), 'fallback')).toBe('Une catégorie similaire existe déjà.');
      expect(mapError(new HttpErrorResponse({ status: 500 }), 'fallback')).toBe('Une erreur serveur est survenue.');
      expect(mapError(new HttpErrorResponse({ status: 418 }), 'fallback')).toBe('fallback');
      expect(mapError(new Error('boom'), 'fallback')).toBe('fallback');
    });

    it('extracts backend messages from payloads', () => {
      const extract = harness().extractBackendMessage.bind(store);
      expect(extract('Plain error')).toBe('Plain error');
      expect(extract({ message: ['First', 'Second'] })).toBe('First Second');
      expect(extract({ message: 'Single' })).toBe('Single');
      expect(extract({ error: 'Nested' })).toBe('Nested');
      expect(extract(null)).toBeNull();
    });
  });
});
