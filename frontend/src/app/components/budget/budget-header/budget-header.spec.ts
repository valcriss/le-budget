import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, ViewContainerRef } from '@angular/core';
import { Overlay, OverlayRef, PositionStrategy } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import { BudgetHeader } from './budget-header';

class OverlayRefStub implements Partial<OverlayRef> {
  readonly backdrop$ = new Subject<MouseEvent>();
  readonly detach$ = new Subject<void>();
  readonly keydown$ = new Subject<KeyboardEvent>();

  readonly componentRef = {
    instance: {
      startClose: jest.fn().mockResolvedValue(undefined),
      available: 0,
      carryover: 0,
      income: 0,
      totalAssigned: 0,
      totalActivity: 0,
      totalAvailable: 0,
      requestClose: undefined as undefined | (() => void),
    },
  };

  attach = jest.fn(() => this.componentRef as any);
  detach = jest.fn();
  dispose = jest.fn();
  backdropClick = jest.fn(() => this.backdrop$);
  detachments = jest.fn(() => this.detach$);
  keydownEvents = jest.fn(() => this.keydown$);
}

class OverlayStub implements Partial<Overlay> {
  readonly ref = new OverlayRefStub();

  readonly position = jest.fn(() => {
    const builder = {
      flexibleConnectedTo: jest.fn().mockReturnThis(),
      withPositions: jest.fn().mockReturnThis(),
      withFlexibleDimensions: jest.fn().mockReturnThis(),
      withPush: jest.fn().mockReturnThis(),
    };
    (builder as any).lastStrategy = builder;
    return builder;
  });

  readonly scrollStrategies = {
    reposition: jest.fn(() => 'scroll-strategy'),
  };

  create = jest.fn(() => this.ref as any);
}

describe('BudgetHeader', () => {
  let fixture: ComponentFixture<BudgetHeader>;
  let component: BudgetHeader;
  let overlayStub: OverlayStub;

  beforeEach(async () => {
    overlayStub = new OverlayStub();

    await TestBed.configureTestingModule({
      imports: [BudgetHeader],
      providers: [
        { provide: Overlay, useValue: overlayStub },
        {
          provide: ViewContainerRef,
          useValue: {
            element: { nativeElement: document.createElement('div') },
            createComponent: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits previous and next month events when not loading', () => {
    const prevSpy = jest.spyOn(component.previousMonth, 'emit');
    const nextSpy = jest.spyOn(component.nextMonth, 'emit');

    const prevEvent = { preventDefault: jest.fn() } as unknown as MouseEvent;
    const nextEvent = { preventDefault: jest.fn() } as unknown as MouseEvent;

    component.onPreviousClick(prevEvent);
    component.onNextClick(nextEvent);

    expect(prevSpy).toHaveBeenCalled();
    expect(nextSpy).toHaveBeenCalled();
    expect(prevEvent.preventDefault).toHaveBeenCalled();
    expect(nextEvent.preventDefault).toHaveBeenCalled();

    component.loading = true;
    component.onPreviousClick();
    component.onNextClick();
    expect(prevSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledTimes(1);
  });

  it('does not open status overlay when loading or unavailable', () => {
    component.loading = true;
    component.toggleStatus();
    expect(overlayStub.create).not.toHaveBeenCalled();

    component.loading = false;
    component.totalAvailable = null;
    component.toggleStatus();
    expect(overlayStub.create).not.toHaveBeenCalled();

    component.totalAvailable = 50;
    component.budgetAvailable = undefined;
    component.toggleStatus();
    expect(overlayStub.create).not.toHaveBeenCalled();
  });

  it('opens overlay, passes data to BudgetStatus, and closes on escape', async () => {
    component.totalAvailable = 100;
    component.availableCarryover = 10;
    component.income = 20;
    component.totalAssigned = 30;
    component.totalActivity = -5;

    const origin = document.createElement('button');
    document.body.appendChild(origin);
    component.budgetAvailable = new ElementRef(origin);

    component.toggleStatus();

    expect(overlayStub.create).toHaveBeenCalled();
    const ref = overlayStub.ref;
    expect(ref.attach).toHaveBeenCalled();
    expect(component.showStatus()).toBe(true);
    expect(ref.componentRef.instance.available).toBe(100);
    expect(ref.componentRef.instance.totalAvailable).toBe(100);
    expect(typeof ref.componentRef.instance.requestClose).toBe('function');

    // simulate escape key via overlay stream
    ref.keydown$.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    // allow async close to resolve
    await Promise.resolve();

    expect(ref.componentRef.instance.startClose).toHaveBeenCalled();
    expect(ref.detach).toHaveBeenCalled();
    expect(ref.dispose).toHaveBeenCalled();
    expect(component.showStatus()).toBe(false);
  });

  it('closes overlay on backdrop clicks', async () => {
    component.totalAvailable = 100;
    component.budgetAvailable = new ElementRef(document.createElement('button'));
    component.toggleStatus();

    overlayStub.ref.backdrop$.next(new MouseEvent('click'));
    await Promise.resolve();

    expect(overlayStub.ref.detach).toHaveBeenCalled();
  });

  it('returns early when closeOverlay is called without an overlay', async () => {
    (component as any).overlayRef = undefined;
    await (component as any).closeOverlay();
    expect(component.showStatus()).toBe(false);
  });

  it('handles missing component instance when attaching overlay', () => {
    component.totalAvailable = 100;
    component.budgetAvailable = new ElementRef(document.createElement('div'));
    overlayStub.ref.attach = jest.fn(() => null as any);

    component.toggleStatus();

    expect(overlayStub.create).toHaveBeenCalled();
    expect(component.showStatus()).toBe(true);
  });

  it('returns focus to origin when overlay detaches', async () => {
    component.totalAvailable = 100;
    const origin = document.createElement('button');
    const focusSpy = jest.spyOn(origin, 'focus');
    component.budgetAvailable = new ElementRef(origin);

    component.toggleStatus();
    overlayStub.ref.detach$.next();
    await Promise.resolve();

    expect(focusSpy).toHaveBeenCalled();
  });

  it('closes overlay when toggle invoked while open', async () => {
    component.totalAvailable = 50;
    component.budgetAvailable = new ElementRef(document.createElement('div'));
    component.toggleStatus(); // open
    expect(component.showStatus()).toBe(true);

    component.toggleStatus(); // close
    await Promise.resolve();
    expect(component.showStatus()).toBe(false);
    expect(overlayStub.ref.componentRef.instance.startClose).toHaveBeenCalled();
  });

  it('keeps overlay open on non-escape keydown events', () => {
    component.totalAvailable = 100;
    component.budgetAvailable = new ElementRef(document.createElement('button'));
    component.toggleStatus();

    overlayStub.ref.keydown$.next(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(component.showStatus()).toBe(true);
  });

  it('handles closeOverlay when component has no startClose', async () => {
    component.totalAvailable = 40;
    component.budgetAvailable = new ElementRef(document.createElement('div'));
    overlayStub.ref.componentRef.instance.startClose = undefined as any;
    component.toggleStatus();
    component.toggleStatus();
    await Promise.resolve();
    expect(overlayStub.ref.detach).toHaveBeenCalled();
  });

  it('swallows startClose errors and still detaches overlay', async () => {
    component.totalAvailable = 40;
    component.budgetAvailable = new ElementRef(document.createElement('div'));
    overlayStub.ref.componentRef.instance.startClose = jest.fn().mockRejectedValue(new Error('boom'));
    component.toggleStatus();
    component.toggleStatus();
    await Promise.resolve();
    expect(overlayStub.ref.detach).toHaveBeenCalled();
  });

  it('reacts to document escape when overlayRef present', async () => {
    const ref = overlayStub.ref;
    (component as any).overlayRef = ref;
    (component as any).attachedCompRef = ref.componentRef;
    component.showStatus.set(true);
    component.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();
    expect(ref.detach).toHaveBeenCalled();
  });

  it('ignores document escape when overlay is not shown', () => {
    const ref = overlayStub.ref;
    (component as any).overlayRef = ref;
    component.showStatus.set(false);
    component.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ref.detach).not.toHaveBeenCalled();
  });

  it('formats currency using shared helper', () => {
    expect(component.formatCurrency(123)).toContain('123');
  });

  it('ignores resize and document clicks by design', () => {
    expect(() => component.onResize()).not.toThrow();
    expect(() => component.onDocClick(new MouseEvent('click'))).not.toThrow();
  });
});
