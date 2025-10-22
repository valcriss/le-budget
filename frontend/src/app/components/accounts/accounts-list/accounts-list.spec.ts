import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountsList } from './accounts-list';

describe('AccountsList', () => {
  let component: AccountsList;
  let fixture: ComponentFixture<AccountsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
