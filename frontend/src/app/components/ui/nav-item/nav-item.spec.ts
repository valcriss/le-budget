import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavItem } from './nav-item';

describe('NavItem', () => {
  let fixture: ComponentFixture<NavItem>;
  let component: NavItem;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavItem],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavItem);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits activated event when triggered', () => {
    const spy = jest.fn();
    component.activated.subscribe(spy);
    component.emitActivate();
    expect(spy).toHaveBeenCalled();
  });

  it('exposes default wrapper/icon classes', () => {
    expect((component as any).defaultWrapper).toContain('group flex');
    expect((component as any).defaultIcon).toContain('w-4');
  });
});
