import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router, ParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { signal } from '@angular/core';

import { BudgetPage } from './budget-page';
import { BudgetStore } from '../../core/budget/budget.store';

class BudgetStoreStub {
  private readonly monthSignal = signal<any>(null);
  private readonly groupsSignal = signal<any[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly monthKeySignal = signal<string | null>(null);

  readonly month = this.monthSignal.asReadonly();
  readonly groups = this.groupsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly monthKey = this.monthKeySignal.asReadonly();

  loadMonth = jasmine.createSpy('loadMonth').and.resolveTo(undefined);
}

describe('BudgetPage', () => {
  let component: BudgetPage;
  let fixture: ComponentFixture<BudgetPage>;
  let store: BudgetStoreStub;
  let navigateSpy: jasmine.Spy;
  let queryParamMap$: Subject<ParamMap>;

  beforeEach(async () => {
    queryParamMap$ = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [BudgetPage],
      providers: [
        { provide: BudgetStore, useClass: BudgetStoreStub },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMap$.asObservable() },
        },
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetPage);
    component = fixture.componentInstance;
    store = TestBed.inject(BudgetStore) as unknown as BudgetStoreStub;
    navigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;
  });

  it('should create and request the current month when no query param is provided', async () => {
    queryParamMap$.next(convertToParamMap({}));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(store.loadMonth).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalled();
  });
});
