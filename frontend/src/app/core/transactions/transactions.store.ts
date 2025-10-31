import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import {
  Transaction,
  TransactionsListResponse,
  TransactionsQuery,
  UpdateTransactionPayload,
} from './transactions.models';

interface TransactionsState {
  accountId: string | null;
  items: Transaction[];
  meta: TransactionsListResponse['meta'];
}

function createInitialState(): TransactionsState {
  return {
    accountId: null,
    items: [],
    meta: { total: 0, skip: 0, take: 50 },
  };
}

@Injectable({ providedIn: 'root' })
export class TransactionsStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly stateSignal = signal<TransactionsState>(createInitialState());
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly transactions = computed(() => this.stateSignal().items);
  readonly meta = computed(() => this.stateSignal().meta);
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  async load(accountId: string, query: TransactionsQuery = {}): Promise<void> {
    if (!accountId) {
      this.reset();
      return;
    }

    this.setLoading(true);
    this.clearError();

    try {
      const params = this.buildQueryParams(query);
      const response = await firstValueFrom(
        this.http.get<TransactionsListResponse>(
          `${this.apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/transactions`,
          { params },
        ),
      );

      this.stateSignal.set({
        accountId,
        items: response.items,
        meta: response.meta,
      });
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de charger les transactions.'));
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async update(
    accountId: string,
    transactionId: string,
    changes: UpdateTransactionPayload,
  ): Promise<Transaction | null> {
    this.setLoading(true);
    this.clearError();

    try {
      const transaction = await firstValueFrom(
        this.http.patch<Transaction>(
          `${this.apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/transactions/${encodeURIComponent(transactionId)}`,
          changes,
        ),
      );

      this.stateSignal.update((state) => {
        if (state.accountId !== accountId) {
          return state;
        }
        return {
          ...state,
          items: state.items.map((item) => (item.id === transactionId ? transaction : item)),
        };
      });

      return transaction;
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de mettre à jour la transaction.'));
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  reset(): void {
    this.stateSignal.set(createInitialState());
    this.clearError();
    this.setLoading(false);
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private buildQueryParams(query: TransactionsQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      params = params.set(key, String(value));
    }
    return params;
  }

  private setLoading(value: boolean): void {
    this.loadingSignal.set(value);
  }

  private mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.extractBackendMessage(error.error);
      switch (error.status) {
        case 400:
          return backendMessage ?? 'La requête est invalide.';
        case 401:
          return backendMessage ?? 'Authentification requise.';
        case 403:
          return backendMessage ?? "Vous n'êtes pas autorisé à effectuer cette action.";
        case 404:
          return backendMessage ?? 'Transaction introuvable.';
        case 409:
          return backendMessage ?? 'Conflit lors de la mise à jour.';
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
