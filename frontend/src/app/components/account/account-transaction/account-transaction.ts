import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Checkbox } from '../../ui/checkbox/checkbox';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerComponent } from '../../ui/date-picker/date-picker';

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
  styleUrl: './account-transaction.css'
})
export class AccountTransaction {
  // Accept a transaction object from the parent. Provide a safe default so the
  // component can render standalone in stories/tests.
  @Input() transaction: any = {
    date: '29/10/2025',
    label: 'Trésor Public',
    category: 'Catégorie',
    debit: -2500,
    credit: 2500,
    balance: 10000,
  };

  // Expose helpers so templates can call them directly.
  formatCurrencyWithSign(value?: string | number, showPlus = true) {
    return formatCurrencyWithSign(value, showPlus);
  }

  getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }
  // Edit mode state
  editing = false;
  // working copy while editing
  editModel: any = null;

  // sample restrictive categories list; ideally this should come from a parent or service
  categories = [
    'Catégorie',
    'Alimentation',
    'Loisirs',
    'Logement',
    'Transports'
  ];

  labels = [
    'Salaire',
    'Trésor Public',
    'Loyer',
    'Supermarché',
    'Électricité',
    'Internet',
    'Assurance',
    'Essence',
    'Remboursement'
  ];

  // fontawesome icons
  protected icSave = faSave;
  protected icTimes = faTimes;

  constructor(library: FaIconLibrary) {
    library.addIcons(faSave, faTimes);
  }

  @Output() update = new EventEmitter<any>();

  // convert date formats: support dd/mm/yyyy <-> yyyy-mm-dd
  private toIsoDate(d: string): string | null {
    if (!d) return null;
    // detect dd/mm/yyyy
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    // detect yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // try parsing with Date and build iso
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }

  private fromIsoDate(iso: string): string {
    if (!iso) return '';
    // return dd/mm/yyyy
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return iso;
  }

  onDoubleClick() {
    // enter edit mode and clone transaction to editModel
    this.editing = true;
    this.editModel = { ...this.transaction };
    // convert date to ISO format for native date input if possible
    const iso = this.toIsoDate(this.editModel.date);
    if (iso) this.editModel.date = iso;
  }

  onCancel() {
    this.editing = false;
    this.editModel = null;
  }

  onSave() {
    if (!this.editModel) return;
    // convert date back to dd/mm/yyyy for storage if original was not ISO
    const originalWasIso = /^\d{4}-\d{2}-\d{2}$/.test(this.transaction.date || '');
    const saveModel = { ...this.editModel };
    if (!originalWasIso && saveModel.date) {
      saveModel.date = this.fromIsoDate(saveModel.date);
    }

    // merge into the original object
    Object.assign(this.transaction, saveModel);
    // emit update event for parent handling
    this.update.emit(this.transaction);

    this.editing = false;
    this.editModel = null;
  }
}
