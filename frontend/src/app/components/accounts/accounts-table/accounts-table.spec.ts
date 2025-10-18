import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountsTable } from './accounts-table';

describe('AccountsTable', () => {
  let component: AccountsTable;
  let fixture: ComponentFixture<AccountsTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsTable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountsTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
