import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BudgetStore } from './budget.store';
import { API_BASE_URL } from '../config/api-base-url.token';
import { EventsGateway } from '../events/events.service';
import { BudgetMonth } from './budget.models';
import { normalizeMonthKey } from './budget.utils';

type SignalSetter<T> = {
  set(value: T): void;
};

type BudgetStoreHarness = BudgetStore & {
  loadingSignal: SignalSetter<boolean>;
  errorSignal: SignalSetter<string | null>;
  refreshMonthInPlace(normalizedKey: string, options?: { silent?: boolean }): Promise<void>;
  mapError(error: unknown, fallback: string): string;
  extractBackendMessage(payload: unknown): string | null;
};

class EventsGatewayStub {
  private readonly listeners = new Map<string, Array<(payload: unknown) => void>>();

  on(event: string, callback: (payload: unknown) => void): () => void {
    const callbacks = this.listeners.get(event) ?? [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
    return () => {
      const list = this.listeners.get(event);
      if (!list) {
        return;
      }
      const index = list.indexOf(callback);
      if (index >= 0) {
        list.splice(index, 1);
      }
    };
  }

  emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }
}

describe('BudgetStore', () => {
  let store: BudgetStore;
  let httpMock: HttpTestingController;
  let events: EventsGatewayStub;
  const getHarness = () => store as unknown as BudgetStoreHarness;

  const apiUrl = 'https://api.test';
  const monthKey = '2024-03';

  const category = {
    id: 'cat-1',
    name: 'Logement',
    kind: 'EXPENSE',
    sortOrder: 0,
    parentCategoryId: null,
    linkedAccountId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const createMonthResponse = (): BudgetMonth & Record<string, unknown> => ({
    id: 'm-1',
    month: monthKey,
    availableCarryover: '10',
    income: '20',
    assigned: '5',
    activity: null,
    available: undefined,
    totalAssigned: '5',
    totalActivity: '3',
    totalAvailable: '7',
    groups: [
      {
        id: 'group-1',
        monthId: 'm-1',
        categoryId: 'root',
        category,
        assigned: '2',
        activity: undefined,
        available: '4',
        items: [
          {
            id: 'budget-1',
            groupId: 'group-1',
            categoryId: 'cat-1',
            category,
            assigned: '1',
            activity: '0',
            available: '1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  });

  beforeEach(() => {
    events = new EventsGatewayStub();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BudgetStore,
        { provide: API_BASE_URL, useValue: apiUrl },
        { provide: EventsGateway, useValue: events },
      ],
    });

    store = TestBed.inject(BudgetStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads a month and normalizes numeric values', async () => {
    const monthPromise = store.loadMonth(monthKey);
    const req = httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`);
    req.flush(createMonthResponse());

    await monthPromise;

    const month = store.month();
    expect(month?.assigned).toBe(5);
    expect(month?.groups[0]?.items[0]?.available).toBe(1);
    expect(store.hasData()).toBe(true);
    expect(store.groups().length).toBe(1);
  });

  it('normalizes month and category values when fields are missing', async () => {
    const response = createMonthResponse();
    response.availableCarryover = undefined;
    response.income = undefined;
    response.assigned = undefined;
    response.activity = undefined;
    response.available = undefined;
    response.totalAssigned = undefined;
    response.totalActivity = undefined;
    response.totalAvailable = undefined;
    response.groups = [
      {
        ...response.groups[0],
        assigned: undefined,
        activity: undefined,
        available: undefined,
        items: [
          {
            ...response.groups[0].items[0],
            assigned: undefined,
            activity: undefined,
            available: undefined,
          },
        ],
      },
    ];

    const monthPromise = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(response);
    await monthPromise;

    const month = store.month();
    expect(month?.availableCarryover).toBe(0);
    expect(month?.income).toBe(0);
    expect(month?.totalAssigned).toBe(0);
    expect(month?.totalActivity).toBe(0);
    expect(month?.totalAvailable).toBe(0);
    expect(month?.groups[0].items[0].assigned).toBe(0);
    expect(month?.groups[0].items[0].activity).toBe(0);
    expect(month?.groups[0].items[0].available).toBe(0);
  });

  it('normalizes groups and months when arrays are missing', () => {
    const normalizeGroup = (store as any).normalizeGroup.bind(store) as (group: any) => any;
    const normalizeMonth = (store as any).normalizeMonth.bind(store) as (month: any) => any;

    const normalizedGroup = normalizeGroup({
      id: 'group',
      items: undefined,
      assigned: undefined,
      activity: undefined,
      available: undefined,
    });
    expect(normalizedGroup.items).toEqual([]);
    expect(normalizedGroup.assigned).toBe(0);
    expect(normalizedGroup.activity).toBe(0);
    expect(normalizedGroup.available).toBe(0);

    const normalizedMonth = normalizeMonth({
      id: 'month',
      month: monthKey,
      groups: undefined,
      availableCarryover: undefined,
      income: undefined,
      assigned: undefined,
      activity: undefined,
      available: undefined,
      totalAssigned: undefined,
      totalActivity: undefined,
      totalAvailable: undefined,
    });
    expect(normalizedMonth.groups).toEqual([]);
    expect(normalizedMonth.availableCarryover).toBe(0);
  });
  it('derives group totals from items when fields are missing', async () => {
    const response = createMonthResponse();
    response.groups = [
      {
        ...response.groups[0],
        assigned: undefined,
        activity: undefined,
        available: undefined,
        items: [
          {
            ...response.groups[0].items[0],
            assigned: '2',
            activity: '-1',
            available: '1',
          },
          {
            ...response.groups[0].items[0],
            id: 'budget-2',
            assigned: '3',
            activity: '0',
            available: '3',
          },
        ],
      },
    ];

    const monthPromise = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(response);

    await monthPromise;

    const group = store.groups()[0];
    expect(group.assigned).toBe(5);
    expect(group.activity).toBe(-1);
    expect(group.available).toBe(4);
  });

  it('maps errors when load fails', async () => {
    const monthPromise = store.loadMonth(monthKey);
    const req = httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`);
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(monthPromise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.error()).toBe('Forbidden');
  });

  it('skips loading when month already cached and not forced', async () => {
    const first = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await first;

    await store.loadMonth(monthKey);
    httpMock.expectNone(`${apiUrl}/budget/months/${monthKey}`);
    expect(store.month()).not.toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('forces reload when flag provided even if month cached', async () => {
    const first = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await first;

    const reload = store.loadMonth(monthKey, true);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await reload;
    expect(store.month()).not.toBeNull();
  });

  it('updates category assignment and refreshes month', async () => {
    const load = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await load;

    const updatePromise = store.updateCategoryAssigned(monthKey, 'cat-1', 200);
    httpMock
      .expectOne(`${apiUrl}/budget/months/${monthKey}/categories/cat-1`)
      .flush(createMonthResponse().groups[0].items[0]);
    await Promise.resolve();
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());

    await updatePromise;
    expect(store.error()).toBeNull();
  });

  it('sets error when update category fails', async () => {
    const updatePromise = store.updateCategoryAssigned(monthKey, 'cat-1', 200);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}/categories/cat-1`).flush(
      { message: 'Not allowed' },
      { status: 403, statusText: 'Forbidden' },
    );

    await expect(updatePromise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.error()).toBe('Not allowed');
  });

  it('swallows refresh errors after updating assigned', async () => {
    const refreshSpy = jest
      .spyOn(store as any, 'refreshMonthInPlace')
      .mockRejectedValue(new Error('fail'));
    const updatePromise = store.updateCategoryAssigned(monthKey, 'cat-1', 200);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}/categories/cat-1`).flush({});

    await expect(updatePromise).resolves.toBeUndefined();
    expect(refreshSpy).toHaveBeenCalled();
    refreshSpy.mockRestore();
  });

  it('responds to server events by refreshing the current month', async () => {
    const load = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await load;

    events.emit('budget.category.updated', { month: monthKey });
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    expect(store.error()).toBeNull();
  });

  it('refreshes current month on month updated events', async () => {
    const load = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await load;

    events.emit('budget.month.updated', { month: monthKey });
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    expect(store.error()).toBeNull();
  });

  it('resets state', () => {
    store.reset();
    expect(store.month()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('skips loading when already in progress', async () => {
    getHarness().loadingSignal.set(true);
    await store.loadMonth(monthKey);
    httpMock.expectNone(`${apiUrl}/budget/months/${monthKey}`);
    getHarness().loadingSignal.set(false);
    expect(store.loading()).toBe(false);
  });

  it('ignores refresh events when no month is selected', () => {
    events.emit('budget.category.updated', { month: monthKey });
    events.emit('budget.month.updated', { month: monthKey });
    httpMock.expectNone(`${apiUrl}/budget/months/${monthKey}`);
    expect(store.month()).toBeNull();
    expect(store.hasData()).toBe(false);
  });

  it('ignores refresh events when payload has no month', async () => {
    const load = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await load;

    events.emit('budget.category.updated', {});
    events.emit('budget.month.updated', {});
    httpMock.expectNone(`${apiUrl}/budget/months/${monthKey}`);
  });

  it('refreshes month in place and reuses pending promise', async () => {
    const normalized = normalizeMonthKey(monthKey);
    const storeHarness = getHarness();
    const refreshPromise = storeHarness.refreshMonthInPlace(normalized);
    const samePromise = storeHarness.refreshMonthInPlace(normalized);
    const req = httpMock.expectOne(`${apiUrl}/budget/months/${normalized}`);
    req.flush(createMonthResponse());
    await Promise.all([refreshPromise, samePromise]);
    expect(store.error()).toBeNull();
  });

  it('handles refresh errors silently when requested', async () => {
    const normalized = normalizeMonthKey(monthKey);
    const promise = getHarness().refreshMonthInPlace(normalized, { silent: true });
    const req = httpMock.expectOne(`${apiUrl}/budget/months/${normalized}`);
    req.flush({ message: 'Oops' }, { status: 500, statusText: 'Error' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.error()).toBeNull();
  });

  it('refreshes month and clears previous error when successful', async () => {
    const load = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await load;

    getHarness().errorSignal.set('prev');
    const updated = createMonthResponse();
    updated.assigned = '42';

    const normalized = normalizeMonthKey(monthKey);
    const refreshPromise = getHarness().refreshMonthInPlace(normalized);
    httpMock.expectOne(`${apiUrl}/budget/months/${normalized}`).flush(updated);
    await refreshPromise;

    expect(store.month()?.assigned).toBe(42);
    expect(store.error()).toBeNull();
  });

  it('sets error when refresh month fails without silent flag', async () => {
    const load = store.loadMonth(monthKey);
    httpMock.expectOne(`${apiUrl}/budget/months/${monthKey}`).flush(createMonthResponse());
    await load;

    const normalized = normalizeMonthKey(monthKey);
    const refreshPromise = getHarness().refreshMonthInPlace(normalized);
    httpMock
      .expectOne(`${apiUrl}/budget/months/${normalized}`)
      .flush({ message: 'Refresh failed' }, { status: 500, statusText: 'Server Error' });

    await expect(refreshPromise).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.error()).toBe('Refresh failed');
  });

  it('reloads current month using current key when none selected', async () => {
    const spy = jest.spyOn(store, 'loadMonth').mockResolvedValue(undefined);

    await store.reloadCurrentMonth();

    expect(spy).toHaveBeenCalledWith(expect.any(String), true);
    spy.mockRestore();
  });

  describe('mapError helpers', () => {
    it('maps http status codes to friendly messages', () => {
      const mapError = getHarness().mapError.bind(store);
      const error = new HttpErrorResponse({ status: 400, error: { message: ['Invalid'] } });
      expect(mapError(error, 'fallback')).toBe('Invalid');
      expect(mapError(new HttpErrorResponse({ status: 400, error: null }), 'fallback')).toBe(
        'Les paramètres fournis sont invalides.',
      );
      expect(mapError(new HttpErrorResponse({ status: 401 }), 'fallback')).toBe('Authentification requise.');
      expect(mapError(new HttpErrorResponse({ status: 403 }), 'fallback')).toBe("Vous n'êtes pas autorisé à consulter ce budget.");
      expect(mapError(new HttpErrorResponse({ status: 404 }), 'fallback')).toBe('Budget introuvable pour ce mois.');
      expect(mapError(new HttpErrorResponse({ status: 500 }), 'fallback')).toBe('Une erreur serveur est survenue.');
      expect(mapError(new HttpErrorResponse({ status: 418 }), 'fallback')).toBe('fallback');
      expect(mapError(new Error('boom'), 'fallback')).toBe('fallback');
    });

    it('extracts backend messages from various payload shapes', () => {
      const extract = getHarness().extractBackendMessage.bind(store);
      expect(extract('Simple error')).toBe('Simple error');
      expect(extract({ message: ['First', 'Second'] })).toBe('First Second');
      expect(extract({ message: 'Single' })).toBe('Single');
      expect(extract({ error: 'Error field' })).toBe('Error field');
      expect(extract({})).toBeNull();
      expect(extract(null)).toBeNull();
    });
  });
});
