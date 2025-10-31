import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import {
  Account,
  AccountType,
  AccountsTotals,
  CreateAccountInput,
} from './accounts.models';
import { AuthStore } from '../auth/auth.store';
import { EventsGateway } from '../events/events.service';

type AccountResponse = {
  id: string;
  name: string;
  type: AccountType | string;
  currency?: string | null;
  initialBalance?: number | string | null;
  currentBalance?: number | string | null;
  reconciledBalance?: number | string | null;
  pointedBalance?: number | string | null;
  archived?: boolean | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly authStore = inject(AuthStore);
  private readonly eventsGateway = inject(EventsGateway);

  private readonly accountsSignal = signal<Account[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly mutationLoadingSignal = signal(false);
  private readonly mutationErrorSignal = signal<string | null>(null);
  private readonly defaultCurrencySignal = computed(() => {
    const user = this.authStore.user();
    return user?.settings?.currency ?? 'EUR';
  });
  readonly defaultCurrency = this.defaultCurrencySignal;

  readonly accounts = this.accountsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly saving = this.mutationLoadingSignal.asReadonly();
  readonly saveError = this.mutationErrorSignal.asReadonly();
  readonly hasData = computed(() => this.accountsSignal().length > 0);
  readonly totals = computed<AccountsTotals>(() => {
    const accounts = this.accountsSignal();
    return accounts.reduce(
      (acc, account) => {
        acc.currentBalance += account.currentBalance;
        acc.reconciledBalance += account.reconciledBalance;
        return acc;
      },
      { currentBalance: 0, reconciledBalance: 0 },
    );
  });

  constructor() {
    this.registerEventListeners();
  }

  async loadAccounts(force = false): Promise<void> {
    if (this.loadingSignal()) {
      return;
    }
    if (!force && this.hasData()) {
      return;
    }

    this.setLoading(true);
    this.clearError();
    try {
      const response = await firstValueFrom(
        this.http.get<AccountResponse[]>(`${this.apiBaseUrl}/accounts`),
      );
      const accounts = response.map((item) => this.normalizeAccount(item));
      this.accountsSignal.set(this.sortAccounts(accounts));
    } catch (error) {
      this.accountsSignal.set([]);
      this.errorSignal.set(this.mapError(error, 'Impossible de charger les comptes.'));
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async reload(): Promise<void> {
    await this.loadAccounts(true);
  }

  async refreshAccount(id: string): Promise<void> {
    if (!id) {
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<AccountResponse>(`${this.apiBaseUrl}/accounts/${encodeURIComponent(id)}`),
      );
      this.applyAccountUpdate(response);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.accountsSignal.update((current) => current.filter((account) => account.id !== id));
        return;
      }
      console.warn('Impossible de rafraîchir le compte', error);
    }
  }

  reset(): void {
    this.accountsSignal.set([]);
    this.clearError();
    this.setLoading(false);
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  clearSaveError(): void {
    this.mutationErrorSignal.set(null);
  }

  getDefaultCurrency(): string {
    return this.defaultCurrencySignal();
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    if (this.mutationLoadingSignal()) {
      throw new Error('Une création est déjà en cours.');
    }

    this.mutationLoadingSignal.set(true);
    this.mutationErrorSignal.set(null);
    try {
      const initialBalance = input.initialBalance ?? 0;
      const reconciledBalance = input.reconciledBalance ?? initialBalance;
      const currency = (input.currency ?? this.defaultCurrencySignal()).toUpperCase();

      const response = await firstValueFrom(
        this.http.post<AccountResponse>(`${this.apiBaseUrl}/accounts`, {
          name: input.name,
          type: input.type,
          initialBalance,
          reconciledBalance,
          currency,
          archived: input.archived ?? false,
        }),
      );
      const account = this.normalizeAccount(response);
      this.accountsSignal.update((list) => this.sortAccounts([...list, account]));
      return account;
    } catch (error) {
      this.mutationErrorSignal.set(this.mapError(error, 'Impossible de créer le compte.'));
      throw error;
    } finally {
      this.mutationLoadingSignal.set(false);
    }
  }

  async updateAccount(id: string, changes: Partial<Pick<Account, 'name' | 'type'>>): Promise<Account> {
    if (this.mutationLoadingSignal()) {
      throw new Error('Une opération est déjà en cours.');
    }

    this.mutationLoadingSignal.set(true);
    this.mutationErrorSignal.set(null);
    try {
      const response = await firstValueFrom(
        this.http.patch<AccountResponse>(`${this.apiBaseUrl}/accounts/${encodeURIComponent(id)}`, {
          name: changes.name,
          type: changes.type,
        }),
      );
      const account = this.normalizeAccount(response);
      this.accountsSignal.update((list) =>
        this.sortAccounts(list.map((item) => (item.id === account.id ? account : item))),
      );
      return account;
    } catch (error) {
      this.mutationErrorSignal.set(this.mapError(error, 'Impossible de mettre à jour le compte.'));
      throw error;
    } finally {
      this.mutationLoadingSignal.set(false);
    }
  }

  private registerEventListeners(): void {
    this.eventsGateway.on('account.updated', (payload) => {
      this.applyAccountUpdate(payload as AccountResponse);
    });
    this.eventsGateway.on('account.created', (payload) => {
      this.applyAccountUpdate(payload as AccountResponse);
    });
    this.eventsGateway.on('account.archived', (payload) => {
      this.applyAccountUpdate(payload as AccountResponse);
    });
  }

  private applyAccountUpdate(payload: AccountResponse): void {
    if (!payload?.id) {
      return;
    }
    const account = this.normalizeAccount(payload);
    this.accountsSignal.update((current) =>
      this.sortAccounts(
        current.some((item) => item.id === account.id)
          ? current.map((item) => (item.id === account.id ? account : item))
          : [...current, account],
      ),
    );
  }

  private normalizeAccount(data: AccountResponse): Account {
    return {
      id: data.id,
      name: data.name,
      type: this.toAccountType(data.type),
      currency: this.normalizeCurrency(data.currency),
      initialBalance: this.toNumber(data.initialBalance),
      currentBalance: this.toNumber(data.currentBalance),
      reconciledBalance: this.toNumber(data.reconciledBalance),
      pointedBalance: this.toNumber(data.pointedBalance),
      archived: Boolean(data.archived),
      createdAt: this.toIsoString(data.createdAt),
      updatedAt: this.toIsoString(data.updatedAt),
    };
  }

  private sortAccounts(accounts: Account[]): Account[] {
    return [...accounts].sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (left === right) {
        return a.name.localeCompare(b.name);
      }
      return left - right;
    });
  }

  private toAccountType(value: AccountType | string | null | undefined): AccountType {
    if (!value) {
      return 'CHECKING';
    }
    const upper = (typeof value === 'string' ? value : String(value)).toUpperCase();
    switch (upper) {
      case 'CHECKING':
      case 'SAVINGS':
      case 'CREDIT_CARD':
      case 'CASH':
      case 'INVESTMENT':
      case 'OTHER':
        return upper as AccountType;
      default:
        return 'OTHER';
    }
  }

  private normalizeCurrency(value: string | null | undefined): string {
    if (!value) {
      return 'EUR';
    }
    return value.toUpperCase().slice(0, 3);
  }

  private toNumber(value: number | string | null | undefined): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private toIsoString(value: string | Date | null | undefined): string | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private setLoading(value: boolean): void {
    this.loadingSignal.set(value);
  }

  private mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.extractBackendMessage(error.error);
      switch (error.status) {
        case 400:
          return backendMessage ?? 'Requête invalide.';
        case 401:
          return backendMessage ?? 'Authentification requise.';
        case 403:
          return backendMessage ?? "Vous n'avez pas accès à ces comptes.";
        case 404:
          return backendMessage ?? 'Aucun compte trouvé.';
        case 500:
          return backendMessage ?? 'Erreur interne du serveur.';
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
      const maybeMessage = (payload as { message?: unknown }).message;
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
