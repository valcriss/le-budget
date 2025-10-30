import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { BudgetCategory, BudgetCategoryGroup, BudgetMonth } from './budget.models';
import { normalizeMonthKey } from './budget.utils';

@Injectable({ providedIn: 'root' })
export class BudgetStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly monthSignal = signal<BudgetMonth | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly monthKeySignal = signal<string | null>(null);

  readonly month = this.monthSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly monthKey = this.monthKeySignal.asReadonly();
  readonly hasData = computed(() => this.monthSignal() !== null);
  readonly groups = computed(() => this.monthSignal()?.groups ?? []);

  async loadMonth(monthKey: string): Promise<void> {
    const normalizedKey = normalizeMonthKey(monthKey);
    if (this.loadingSignal()) {
      return;
    }
    if (this.monthSignal() && this.monthKeySignal() === normalizedKey) {
      return;
    }

    this.setLoading(true);
    this.clearError();
    try {
      const month = await firstValueFrom(
        this.http.get<BudgetMonth>(
          `${this.apiBaseUrl}/budget/months/${encodeURIComponent(normalizedKey)}`,
        ),
      );
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
