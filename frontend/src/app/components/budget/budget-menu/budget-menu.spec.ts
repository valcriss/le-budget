import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Dialog } from '@angular/cdk/dialog';
import { BudgetMenu } from './budget-menu';
import { CategoryCreateDialog } from '../category-create-dialog/category-create-dialog';

describe('BudgetMenu', () => {
  let fixture: ComponentFixture<BudgetMenu>;
  let component: BudgetMenu;
  let dialogOpenSpy: jest.Mock;

  beforeEach(async () => {
    dialogOpenSpy = jest.fn(() => ({ close: jest.fn() } as any));

    TestBed.configureTestingModule({
      imports: [BudgetMenu],
      providers: [provideAnimations()],
    });

    TestBed.overrideProvider(Dialog, { useValue: { open: dialogOpenSpy } });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(BudgetMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the category group creation dialog', () => {
    component.openCreateGroupDialog();
    expect(dialogOpenSpy).toHaveBeenCalledWith(CategoryCreateDialog, {
      data: expect.objectContaining({
        mode: 'create',
        parentCategoryId: null,
        title: 'Créer un groupe de catégorie',
      }),
    });
  });
});
