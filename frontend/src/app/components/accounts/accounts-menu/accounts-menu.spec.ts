import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountsMenu } from './accounts-menu';

describe('AccountsMenu', () => {
  let component: AccountsMenu;
  let fixture: ComponentFixture<AccountsMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsMenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountsMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
