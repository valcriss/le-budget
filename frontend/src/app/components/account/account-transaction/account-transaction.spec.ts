import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { AccountTransaction } from './account-transaction';

class CategoriesStoreStub {
  readonly categories = signal([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly ensureLoaded = jasmine.createSpy('ensureLoaded').and.returnValue(Promise.resolve());
}

describe('AccountTransaction', () => {
  let component: AccountTransaction;
  let fixture: ComponentFixture<AccountTransaction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountTransaction],
      providers: [{ provide: CategoriesStore, useClass: CategoriesStoreStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountTransaction);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
