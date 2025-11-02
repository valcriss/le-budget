import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { BudgetCategory, BudgetCategoryGroup, BudgetMonth } from './budget.models';
import { getCurrentMonthKey, normalizeMonthKey } from './budget.utils';
import { EventsGateway } from '../events/events.service';

@Injectable({ providedIn: 'root' })
export class BudgetStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly eventsGateway = inject(EventsGateway);

  private readonly monthSignal = signal<BudgetMonth | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly monthKeySignal = signal<string | null>(null);
  private refreshPromise: Promise<void> | null = null;

  readonly month = this.monthSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly monthKey = this.monthKeySignal.asReadonly();
  readonly hasData = computed(() => this.monthSignal() !== null);
  readonly groups = computed(() => this.monthSignal()?.groups ?? []);

  constructor() {
    this.registerEventListeners();
  }

  async loadMonth(monthKey: string, force = false): Promise<void> {
    const normalizedKey = normalizeMonthKey(monthKey);
    if (this.loadingSignal()) {
      return;
    }
    if (!force && this.monthSignal() && this.monthKeySignal() === normalizedKey) {
      return;
    }

    this.setLoading(true);
    this.clearError();
    try {
      const month = await this.fetchMonth(normalizedKey);
      this.monthKeySignal.set(normalizedKey);
      this.monthSignal.set(this.normalizeMonth(month));
    } catch (error) {
      this.monthSignal.set(null);
      this.errorSignal.set(this.mapError(error, 'Impossible de charger le budget.'));
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async reloadCurrentMonth(): Promise<void> {
    const currentKey = this.monthKeySignal() ?? getCurrentMonthKey();
    await this.loadMonth(currentKey, true);
  }

  async updateCategoryAssigned(monthKey: string, categoryId: string, assigned: number): Promise<void> {
    const normalizedMonth = normalizeMonthKey(monthKey);
    const encodedMonth = encodeURIComponent(normalizedMonth);
    const encodedCategory = encodeURIComponent(categoryId);

    try {
      await firstValueFrom(
        this.http.patch<BudgetCategory>(
          `${this.apiBaseUrl}/budget/months/${encodedMonth}/categories/${encodedCategory}`,
          { assigned },
        ),
      );
      await this.refreshMonthInPlace(normalizedMonth).catch(() => undefined);
    } catch (error) {
      this.errorSignal.set(
        this.mapError(error, 'Impossible de mettre à jour le montant assigné.'),
      );
      throw error;
    }
  }

  reset(): void {
    this.monthSignal.set(null);
    this.monthKeySignal.set(null);
    this.clearError();
    this.setLoading(false);
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private normalizeMonth(data: BudgetMonth): BudgetMonth {
    const groups = (data.groups ?? []).map((group) => this.normalizeGroup(group));
    return {
      ...data,
      availableCarryover: Number(data.availableCarryover ?? 0),
      income: Number(data.income ?? 0),
      assigned: Number(data.assigned ?? 0),
      activity: Number(data.activity ?? 0),
      available: Number(data.available ?? 0),
      totalAssigned: Number(data.totalAssigned ?? 0),
      totalActivity: Number(data.totalActivity ?? 0),
      totalAvailable: Number(data.totalAvailable ?? 0),
      groups,
    };
  }

  private normalizeGroup(group: BudgetCategoryGroup): BudgetCategoryGroup {
    const items = (group.items ?? []).map((item) => this.normalizeCategory(item));
    const assigned =
      group.assigned !== undefined
        ? Number(group.assigned)
        : items.reduce((sum, item) => sum + item.assigned, 0);
    const activity =
      group.activity !== undefined
        ? Number(group.activity)
        : items.reduce((sum, item) => sum + item.activity, 0);
    const available =
      group.available !== undefined
        ? Number(group.available)
        : items.reduce((sum, item) => sum + item.available, 0);
    return {
      ...group,
      assigned,
      activity,
      available,
      items,
    };
  }

  private normalizeCategory(category: BudgetCategory): BudgetCategory {
    return {
      ...category,
      assigned: Number(category.assigned ?? 0),
      activity: Number(category.activity ?? 0),
      available: Number(category.available ?? 0),
    };
  }

  private fetchMonth(normalizedKey: string): Promise<BudgetMonth> {
    return firstValueFrom(
      this.http.get<BudgetMonth>(
        `${this.apiBaseUrl}/budget/months/${encodeURIComponent(normalizedKey)}`,
      ),
    );
  }

  private async refreshMonthInPlace(
    normalizedKey: string,
    options?: { silent?: boolean },
  ): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const month = await this.fetchMonth(normalizedKey);
        if (this.monthKeySignal() === normalizedKey) {
          this.monthSignal.set(this.normalizeMonth(month));
        }
        if (!options?.silent) {
          this.clearError();
        }
      } catch (error) {
        if (!options?.silent) {
          this.errorSignal.set(this.mapError(error, 'Impossible de rafraîchir le budget.'));
        }
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private registerEventListeners(): void {
    this.eventsGateway.on('budget.category.updated', (payload) => {
      const currentKey = this.monthKeySignal();
      if (!currentKey) {
        return;
      }

      const month = (payload as { month?: string }).month;
      if (!month) {
        return;
      }

      const normalizedMonth = normalizeMonthKey(month);
      if (normalizedMonth === normalizeMonthKey(currentKey)) {
        void this.refreshMonthInPlace(normalizedMonth, { silent: true }).catch(() => undefined);
      }
    });

    this.eventsGateway.on('budget.month.updated', (payload) => {
      const currentKey = this.monthKeySignal();
      if (!currentKey) {
        return;
      }

      const month = (payload as { month?: string }).month;
      if (!month) {
        return;
      }

      const normalizedMonth = normalizeMonthKey(month);
      if (normalizedMonth === normalizeMonthKey(currentKey)) {
        void this.refreshMonthInPlace(normalizedMonth, { silent: true }).catch(() => undefined);
      }
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
          return backendMessage ?? 'Les paramètres fournis sont invalides.';
        case 401:
          return backendMessage ?? 'Authentification requise.';
        case 403:
          return backendMessage ?? "Vous n'êtes pas autorisé à consulter ce budget.";
        case 404:
          return backendMessage ?? 'Budget introuvable pour ce mois.';
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
}
