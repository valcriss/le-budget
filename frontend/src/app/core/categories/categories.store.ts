import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import {
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from './categories.models';

@Injectable({ providedIn: 'root' })
export class CategoriesStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly categoriesSignal = signal<Category[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly loadedSignal = signal(false);

  readonly categories = this.categoriesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly hasData = computed(() => this.loadedSignal() && this.categoriesSignal().length > 0);

  async load(force = false): Promise<void> {
    if (this.loadingSignal()) {
      return;
    }
    if (this.loadedSignal() && !force) {
      return;
    }

    this.setLoading(true);
    this.clearError();
    try {
      const categories = await firstValueFrom(
        this.http.get<Category[]>(`${this.apiBaseUrl}/categories`),
      );
      this.setCategories(categories);
      this.loadedSignal.set(true);
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de charger les catégories.'));
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async ensureLoaded(): Promise<void> {
    await this.load(false).catch(() => undefined);
  }

  async create(payload: CreateCategoryPayload): Promise<Category | null> {
    this.setLoading(true);
    this.clearError();

    try {
      const category = await firstValueFrom(
        this.http.post<Category>(`${this.apiBaseUrl}/categories`, payload),
      );
      this.categoriesSignal.update((current) =>
        [...current, category].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return category;
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de créer cette catégorie.'));
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  async update(id: string, changes: UpdateCategoryPayload): Promise<Category | null> {
    this.setLoading(true);
    this.clearError();

    try {
      const category = await firstValueFrom(
        this.http.patch<Category>(`${this.apiBaseUrl}/categories/${id}`, changes),
      );
      this.categoriesSignal.update((current) =>
        current
          .map((item) => (item.id === id ? category : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return category;
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de mettre à jour cette catégorie.'));
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  async remove(id: string): Promise<boolean> {
    this.setLoading(true);
    this.clearError();

    try {
      await firstValueFrom(this.http.delete(`${this.apiBaseUrl}/categories/${id}`));
      this.categoriesSignal.update((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      this.errorSignal.set(this.mapError(error, 'Impossible de supprimer cette catégorie.'));
      return false;
    } finally {
      this.setLoading(false);
    }
  }

  reset(): void {
    this.categoriesSignal.set([]);
    this.loadedSignal.set(false);
    this.clearError();
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private setCategories(categories: Category[]): void {
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    this.categoriesSignal.set(sorted);
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
          return backendMessage ?? 'Catégorie introuvable.';
        case 409:
          return backendMessage ?? 'Une catégorie similaire existe déjà.';
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
