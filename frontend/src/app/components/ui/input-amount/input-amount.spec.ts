import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputAmount } from './input-amount';

describe('InputAmount', () => {
  let component: InputAmount;
  let fixture: ComponentFixture<InputAmount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputAmount]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputAmount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
