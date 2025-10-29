import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountTable } from './account-table';

describe('AccountTable', () => {
  let component: AccountTable;
  let fixture: ComponentFixture<AccountTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountTable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
