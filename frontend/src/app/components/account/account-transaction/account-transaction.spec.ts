import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountTransaction } from './account-transaction';

describe('AccountTransaction', () => {
  let component: AccountTransaction;
  let fixture: ComponentFixture<AccountTransaction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountTransaction]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountTransaction);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
