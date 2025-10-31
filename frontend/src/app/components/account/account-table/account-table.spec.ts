import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TransactionsStore } from '../../../core/transactions/transactions.store';
import { AccountTable } from './account-table';

class TransactionsStoreStub {
  readonly transactions = signal([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jasmine.createSpy('load').and.returnValue(Promise.resolve());
  readonly update = jasmine.createSpy('update').and.returnValue(Promise.resolve(null));
  readonly reset = jasmine.createSpy('reset');
}

describe('AccountTable', () => {
  let component: AccountTable;
  let fixture: ComponentFixture<AccountTable>;

  beforeEach(async () => {
    const paramMap = convertToParamMap({ id: 'account-1' });
    await TestBed.configureTestingModule({
      imports: [AccountTable],
      providers: [
        { provide: TransactionsStore, useClass: TransactionsStoreStub },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(paramMap),
            snapshot: { paramMap },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
