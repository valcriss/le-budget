import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeAmount } from './badge-amount';

describe('BadgeAmount', () => {
  let component: BadgeAmount;
  let fixture: ComponentFixture<BadgeAmount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeAmount],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeAmount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('selects background class based on amount and needed', () => {
    component.amount = -10;
    expect(component.bgClass).toContain('rose');

    component.amount = 0;
    component.needed = 0;
    expect(component.bgClass).toContain('gray');

    component.amount = 100;
    component.needed = 50;
    expect(component.bgClass).toContain('emerald');

    component.amount = 25;
    component.needed = 50;
    expect(component.bgClass).toContain('yellow');
  });

  it('falls back to gray class when no criteria matches', () => {
    component.amount = undefined;
    component.needed = 10;
    expect(component.bgClass).toContain('gray');
  });

  it('formats amount without plus sign', () => {
    component.amount = 123.45;
    expect(component.formatted()).toContain('123');
    expect(component.formatted().startsWith('+')).toBe(false);
  });
});
