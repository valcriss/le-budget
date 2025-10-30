import { Component, Inject, signal } from '@angular/core';
import { DialogModule, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { BudgetStore } from '../../../core/budget/budget.store';
import { Category } from '../../../core/categories/categories.models';

export interface CategoryCreateDialogData {
  mode: 'create' | 'edit';
  parentCategoryId?: string | null;
  title?: string;
  nameLabel?: string;
  placeholder?: string;
  category?: Category;
  sortOrder?: number;
}

@Component({
  selector: 'app-category-create-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ReactiveFormsModule],
  templateUrl: './category-create-dialog.html',
  styleUrl: './category-create-dialog.css',
})
export class CategoryCreateDialog {
  get title(): string {
    if (this.isEdit()) {
      return this.data?.title ?? 'Modifier la catégorie';
    }
    return this.data?.title ?? 'Créer une catégorie';
  }

  get nameLabel(): string {
    return this.data?.nameLabel ?? 'Nom de la catégorie';
  }

  get placeholder(): string {
    return this.data?.placeholder ?? 'Ex : Courses';
  }

  readonly nameControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });

  readonly isSubmitting = signal(false);
  readonly hasError = signal<string | null>(null);

  constructor(
    private readonly dialogRef: DialogRef<boolean>,
    private readonly categoriesStore: CategoriesStore,
    private readonly budgetStore: BudgetStore,
    @Inject(DIALOG_DATA) readonly data: CategoryCreateDialogData,
  ) {
    const initialName = (this.data?.category?.name ?? '').trim();
    if (initialName) {
      this.nameControl.setValue(initialName);
    }
  }

  get disableSubmit(): boolean {
    const value = (this.nameControl.value ?? '').trim();
    return this.isSubmitting() || value.length === 0;
  }

  get submitLabel(): string {
    return this.isEdit() ? 'Mettre à jour' : 'Créer';
  }

  isEdit(): boolean {
    return this.data?.mode === 'edit' && !!this.data?.category;
  }

  close(): void {
    if (!this.isSubmitting()) {
      this.dialogRef.close(false);
    }
  }

  async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();

    const rawValue = this.nameControl.value ?? '';
    const trimmed = rawValue.trim();

    if (!trimmed) {
      this.nameControl.markAsTouched();
      return;
    }
    this.categoriesStore.clearError();
    this.hasError.set(null);

    if (this.isEdit() && this.data?.category) {
      const current = this.data.category;
      if (trimmed === (current.name ?? '').trim()) {
        this.dialogRef.close(true);
        return;
      }

      this.isSubmitting.set(true);
      try {
        const updated = await this.categoriesStore.update(current.id, { name: trimmed });
        if (!updated) {
          const storeError = this.categoriesStore.error();
          this.hasError.set(storeError ?? 'Impossible de mettre à jour cette catégorie.');
          return;
        }

        await this.budgetStore.reloadCurrentMonth();
        this.dialogRef.close(true);
      } catch (error) {
        console.error('Failed to update category', error);
        this.hasError.set('Une erreur est survenue. Veuillez réessayer.');
      } finally {
        this.isSubmitting.set(false);
      }
      return;
    }

    this.isSubmitting.set(true);
    try {
      const result = await this.categoriesStore.create({
        name: trimmed,
        kind: 'EXPENSE',
        parentCategoryId: this.data?.parentCategoryId ?? null,
        sortOrder: this.data?.sortOrder,
      });

      if (!result) {
        const storeError = this.categoriesStore.error();
        this.hasError.set(storeError ?? 'Impossible de créer cette catégorie.');
        return;
      }

      await this.budgetStore.reloadCurrentMonth();
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to create category', error);
      this.hasError.set('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async deleteCategory(): Promise<void> {
    if (!this.isEdit() || !this.data?.category || this.isSubmitting()) {
      return;
    }

    const confirmed = window.confirm('Supprimer cette catégorie ?');
    if (!confirmed) {
      return;
    }

    this.categoriesStore.clearError();
    this.hasError.set(null);
    this.isSubmitting.set(true);

    try {
      const success = await this.categoriesStore.remove(this.data.category.id);
      if (!success) {
        const storeError = this.categoriesStore.error();
        this.hasError.set(storeError ?? 'Impossible de supprimer cette catégorie.');
        return;
      }

      await this.budgetStore.reloadCurrentMonth();
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to delete category', error);
      this.hasError.set('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
