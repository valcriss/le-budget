import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { A11yModule, FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import {
  ACCOUNT_TYPE_OPTIONS,
  AccountType,
  CreateAccountInput,
} from '../../../core/accounts/accounts.models';

type AccountDialogValue = Omit<CreateAccountInput, 'archived'>;

@Component({
  selector: 'app-account-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, A11yModule, FontAwesomeModule],
  templateUrl: './account-dialog.html',
  styleUrl: './account-dialog.css',
})
export class AccountDialog implements AfterViewInit, OnDestroy {
  @Input() title = 'Nouveau compte bancaire';
  @Input() submitLabel = 'Créer le compte';
  @Input() submitting = false;
  @Input() serverError: string | null = null;

  @Input()
  set initialValue(value: Partial<AccountDialogValue> | null) {
    this.applyInitialValue(value);
  }

  @Output() cancelled = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<AccountDialogValue>();

  @ViewChild('dialog', { read: ElementRef, static: true }) dialogRef?: ElementRef<HTMLElement>;
  private focusTrap?: FocusTrap;

  protected readonly accountTypeOptions = ACCOUNT_TYPE_OPTIONS;
  protected readonly icClose = faXmark;
  protected readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    type: ['CHECKING' as AccountType, Validators.required],
    institution: ['', [Validators.maxLength(120)]],
    currency: ['EUR', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    initialBalance: [''],
    reconciledBalance: [''],
  });

  private readonly focusTrapFactory = inject(FocusTrapFactory);

  constructor(library: FaIconLibrary) {
    library.addIcons(faXmark);
  }

  ngAfterViewInit(): void {
    const el = this.dialogRef?.nativeElement;
    if (!el) {
      return;
    }
    this.focusTrap = this.focusTrapFactory.create(el);
    setTimeout(() => {
      try {
        this.focusTrap?.focusInitialElement();
      } catch {
        /* ignore */
      }
    }, 0);
  }

  ngOnDestroy(): void {
    this.focusTrap?.destroy();
  }

  protected onCancel(): void {
    if (this.submitting) {
      return;
    }
    this.cancelled.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).dataset['backdrop'] === 'true') {
      this.onCancel();
    }
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.value;
    const payload: AccountDialogValue = {
      name: (value.name ?? '').trim(),
      type: (value.type ?? 'CHECKING') as AccountType,
      institution: this.normalizeTextField(value.institution),
      currency: (value.currency ?? 'EUR').toUpperCase(),
      initialBalance: this.normalizeNumberField(value.initialBalance),
      reconciledBalance: this.normalizeNumberField(value.reconciledBalance),
    };
    this.submitted.emit(payload);
  }

  protected hasError(controlName: keyof typeof this.form.controls, error: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(error);
  }

  protected disableSubmit(): boolean {
    return this.submitting || this.form.invalid;
  }

  private applyInitialValue(value: Partial<AccountDialogValue> | null | undefined): void {
    const snapshot = {
      name: value?.name ?? '',
      type: value?.type ?? ('CHECKING' as AccountType),
      institution: value?.institution ?? '',
      currency: (value?.currency ?? 'EUR').toUpperCase(),
      initialBalance: this.formatNumber(value?.initialBalance),
      reconciledBalance: this.formatNumber(value?.reconciledBalance),
    };
    this.form.reset(snapshot);
  }

  private normalizeTextField(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeNumberField(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }
}
