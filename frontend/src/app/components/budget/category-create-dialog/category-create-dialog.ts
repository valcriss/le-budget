import { Component, Inject, signal, computed } from '@angular/core';
import { DialogModule, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { BudgetStore } from '../../../core/budget/budget.store';

export interface CategoryCreateDialogData {
  parentCategoryId: string | null;
  title: string;
  nameLabel?: string;
  placeholder?: string;
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

  get disableSubmit(): boolean {
    if (this.isSubmitting()) {
      return true;
    }
    const value = this.nameControl.value ?? '';
    return !value.trim();
  }

  constructor(
    private readonly dialogRef: DialogRef<boolean>,
    private readonly categoriesStore: CategoriesStore,
    private readonly budgetStore: BudgetStore,
    @Inject(DIALOG_DATA) readonly data: CategoryCreateDialogData,
  ) {}

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
    this.isSubmitting.set(true);
    this.hasError.set(null);
    this.categoriesStore.clearError();
    try {
      const result = await this.categoriesStore.create({
        name: trimmed,
        kind: 'EXPENSE',
        parentCategoryId: this.data?.parentCategoryId ?? null,
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
      this.hasError.set("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
