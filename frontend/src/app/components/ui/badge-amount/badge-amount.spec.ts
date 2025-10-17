import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgeAmount } from './badge-amount';

describe('BadgeAmount', () => {
  let component: BadgeAmount;
  let fixture: ComponentFixture<BadgeAmount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeAmount]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BadgeAmount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
