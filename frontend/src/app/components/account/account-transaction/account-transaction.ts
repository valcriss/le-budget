import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircle, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { Checkbox } from '../../ui/checkbox/checkbox';
import { DatePickerComponent } from '../../ui/date-picker/date-picker';
import {
  formatCurrencyWithSign,
  getAmountClass,
  toNumber,
} from '../../../shared/formatters';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { Category } from '../../../core/categories/categories.models';
import {
  Transaction,
  UpdateTransactionPayload,
  TransactionStatus,
} from '../../../core/transactions/transactions.models';

interface EditModel {
  date: string;
  label: string;
  categoryId: string | null;
  debit: string | number | null;
  credit: string | number | null;
}

export interface AccountTransactionUpdateEvent {
  id: string;
  changes: UpdateTransactionPayload;
}

export interface AccountTransactionStatusEvent {
  id: string;
  status: TransactionStatus;
}

@Component({
  selector: 'app-account-transaction',
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    Checkbox,
    NgSelectModule,
    DatePickerComponent,
  ],
  templateUrl: './account-transaction.html',
  styleUrl: './account-transaction.css',
})
export class AccountTransaction implements OnChanges {
  @Input()
  transaction: Transaction = {
    id: 'transaction-demo',
    accountId: 'account-demo',
    date: new Date().toISOString(),
    label: 'Trésor Public',
    categoryId: null,
    categoryName: 'Catégorie',
    amount: -2500,
    balance: 10000,
    status: 'NONE',
    transactionType: 'NONE',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  @Input() autoEditKey: number | null = null;
  @Input() isNew = false;

  @Output() readonly save = new EventEmitter<AccountTransactionUpdateEvent>();
  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly changeStatus = new EventEmitter<AccountTransactionStatusEvent>();

  protected readonly icCircle = faCircle;
  protected readonly icTimes = faTimes;
  protected readonly icSave = faSave;

  protected editing = false;
  protected editModel: EditModel | null = null;

  private readonly categoriesStore = inject(CategoriesStore);

  protected readonly categoryOptions = computed<ReadonlyArray<Category>>(() =>
    [...this.categoriesStore.categories()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly categoriesLoading = this.categoriesStore.loading;
  protected readonly categoriesError = this.categoriesStore.error;

  protected readonly labels = [
    'Salaire',
    'Trésor Public',
    'Loyer',
    'Supermarché',
    'Électricité',
    'Internet',
    'Assurance',
    'Essence',
    'Remboursement',
  ];

  constructor(library: FaIconLibrary) {
    library.addIcons(faSave, faTimes, faCircle);
    void this.categoriesStore.ensureLoaded();
  }

  protected formatCurrencyWithSign(value?: string | number, showPlus = true, hideZero = false) {
    return formatCurrencyWithSign(value, showPlus, hideZero);
  }

  protected getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }

  protected formatDisplayDate(value: string): string {
    if (!value) {
      return '';
    }
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('fr-FR').format(parsed);
  }

  protected debitAmount(transaction: Transaction): number {
    return transaction.amount < 0 ? transaction.amount : 0;
  }

  protected creditAmount(transaction: Transaction): number {
    return transaction.amount > 0 ? transaction.amount : 0;
  }

  protected statusIconClass(): string {
    switch (this.transaction.status) {
      case 'POINTED':
        return 'text-emerald-500';
      case 'RECONCILED':
        return 'text-sky-600';
      default:
        return 'text-gray-300';
    }
  }

  protected statusIconTitle(): string {
    switch (this.transaction.status) {
      case 'POINTED':
        return 'Cliquez ici pour dépointer la transaction';
      case 'RECONCILED':
        return 'Transaction rapprochée';
      default:
        return 'Cliquez ici pour pointer la transaction';
    }
  }

  protected canToggleStatus(): boolean {
    return this.transaction.status === 'NONE' || this.transaction.status === 'POINTED';
  }

  protected onStatusToggle(): void {
    if (!this.canToggleStatus()) {
      return;
    }
    const nextStatus: TransactionStatus =
      this.transaction.status === 'POINTED' ? 'NONE' : 'POINTED';
    this.changeStatus.emit({ id: this.transaction.id, status: nextStatus });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['autoEditKey'] && this.autoEditKey != null) ||
      (changes['transaction'] && this.autoEditKey != null)
    ) {
      this.startEditing();
    }
  }

  private startEditing(): void {
    this.editing = true;
    this.editModel = this.createEditModel();
  }

  protected onDoubleClick(): void {
    this.startEditing();
  }

  protected onCancel(): void {
    this.editing = false;
    this.editModel = null;
    this.cancel.emit();
  }

  protected onSave(): void {
    if (!this.editModel) {
      return;
    }

    const debitValue = Math.abs(toNumber(this.editModel.debit ?? 0));
    const creditValue = Math.abs(toNumber(this.editModel.credit ?? 0));

    let amount = this.transaction.amount;
    if (debitValue > 0 && creditValue > 0) {
      amount = creditValue - debitValue;
    } else if (debitValue > 0) {
      amount = -debitValue;
    } else if (creditValue > 0) {
      amount = creditValue;
    } else {
      amount = 0;
    }

    if (!Number.isFinite(amount)) {
      amount = 0;
    }

    const label =
      this.transaction.transactionType === 'INITIAL'
        ? this.transaction.label
        : (this.editModel.label ?? '').trim() || this.transaction.label;
    const date = this.sanitizeDate(this.editModel.date);

    const changes: UpdateTransactionPayload = {
      label,
      date,
      amount,
      categoryId:
        this.transaction.transactionType === 'INITIAL'
          ? this.transaction.categoryId ?? null
          : this.editModel.categoryId ?? null,
    };

    this.save.emit({
      id: this.transaction.id,
      changes,
    });

    this.editing = false;
    this.editModel = null;
  }

  private createEditModel(): EditModel {
    const amount = this.transaction.amount;
    return {
      date: this.toInputDate(this.transaction.date),
      label: this.transaction.label,
      categoryId: this.transaction.categoryId ?? null,
      debit: amount < 0 ? Math.abs(amount) : null,
      credit: amount > 0 ? amount : null,
    };
  }

  private toInputDate(value: string): string {
    if (!value) {
      return '';
    }
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toISOString().slice(0, 10);
  }

  private sanitizeDate(value: string): string {
    if (!value) {
      return this.toInputDate(this.transaction.date) || this.transaction.date;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return this.toInputDate(this.transaction.date) || this.transaction.date;
    }
    return parsed.toISOString().slice(0, 10);
  }
}
