import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FocusTrapFactory, FocusTrap } from '@angular/cdk/a11y';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { AccountDialog } from './account-dialog';

class FocusTrapStub implements Partial<FocusTrap> {
  focusInitialElement = jest.fn();
  destroy = jest.fn();
}

describe('AccountDialog', () => {
  let fixture: ComponentFixture<AccountDialog>;
  let component: AccountDialog;
  let focusTrap: FocusTrapStub;
  let focusTrapFactory: { create: jest.Mock };
  let iconLibrary: { addIcons: jest.Mock };

  beforeEach(async () => {
    focusTrap = new FocusTrapStub();
    focusTrapFactory = { create: jest.fn().mockReturnValue(focusTrap) };
    iconLibrary = { addIcons: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [AccountDialog],
      providers: [
        { provide: FocusTrapFactory, useValue: focusTrapFactory },
        { provide: FaIconLibrary, useValue: iconLibrary },
      ],
    }).compileComponents();

    jest.useFakeTimers();
    fixture = TestBed.createComponent(AccountDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('creates a focus trap on init', () => {
    expect(focusTrapFactory.create).toHaveBeenCalled();
    expect(focusTrap.focusInitialElement).toHaveBeenCalled();
  });

  it('ignores focus setup when dialog element missing', () => {
    component['dialogRef'] = undefined;
    focusTrapFactory.create.mockClear();

    component.ngAfterViewInit();

    expect(focusTrapFactory.create).not.toHaveBeenCalled();
  });

  it('applies the provided initial value', () => {
    component.initialValue = { name: 'Compte', type: 'SAVINGS', initialBalance: 150 };
    fixture.detectChanges();

    expect(component['form'].value).toEqual({
      name: 'Compte',
      type: 'SAVINGS',
      initialBalance: '150',
    });
  });

  it('defaults missing initial value fields', () => {
    component.initialValue = { name: undefined, type: undefined, initialBalance: null };
    fixture.detectChanges();

    expect(component['form'].value).toEqual({
      name: '',
      type: 'CHECKING',
      initialBalance: '',
    });
  });

  it('emits cancel unless submitting', () => {
    const cancelled = jest.spyOn(component.cancelled, 'emit');

    component.submitting = false;
    component['onCancel']();
    expect(cancelled).toHaveBeenCalledTimes(1);

    component.submitting = true;
    component['onCancel']();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('emits cancel when clicking on backdrop', () => {
    const cancelled = jest.spyOn(component.cancelled, 'emit');
    const event = { target: { dataset: { backdrop: 'true' } } } as unknown as MouseEvent;

    component.submitting = false;
    component['onBackdropClick'](event);

    expect(cancelled).toHaveBeenCalled();
  });

  it('marks controls as touched when submitting invalid form', () => {
    const nameControl = component['form'].controls.name;
    expect(nameControl.touched).toBe(false);

    component['onSubmit']();

    expect(nameControl.touched).toBe(true);
  });

  it('emits the trimmed payload on submit', () => {
    const submitted = jest.spyOn(component.submitted, 'emit');

    component['form'].setValue({
      name: '  Nouveau compte  ',
      type: 'CHECKING',
      initialBalance: '123.45',
    });

    component['onSubmit']();

    expect(submitted).toHaveBeenCalledWith({
      name: 'Nouveau compte',
      type: 'CHECKING',
      initialBalance: 123.45,
    });
  });

  it('normalizes non numeric initial balance to undefined', () => {
    const submitted = jest.spyOn(component.submitted, 'emit');

    component['form'].setValue({
      name: 'Compte',
      type: 'SAVINGS',
      initialBalance: 'abc',
    });

    component['onSubmit']();

    expect(submitted).toHaveBeenCalledWith({
      name: 'Compte',
      type: 'SAVINGS',
      initialBalance: undefined,
    });

    submitted.mockClear();
    component['form'].setValue({
      name: 'Compte',
      type: 'SAVINGS',
      initialBalance: '',
    });

    component['onSubmit']();

    expect(submitted).toHaveBeenCalledWith({
      name: 'Compte',
      type: 'SAVINGS',
      initialBalance: undefined,
    });
  });

  it('disables submit when form invalid or submitting', () => {
    component.submitting = false;
    expect(component['disableSubmit']()).toBe(true);

    component['form'].controls.name.setValue('Banque');
    component['form'].controls.type.setValue('SAVINGS');
    component['form'].controls.initialBalance.setValue('');
    expect(component['disableSubmit']()).toBe(false);

    component.submitting = true;
    expect(component['disableSubmit']()).toBe(true);
  });

  it('reports control errors when touched', () => {
    component['form'].controls.name.setErrors({ required: true });
    component['form'].controls.name.markAsTouched();

    expect(component['hasError']('name', 'required')).toBe(true);
  });

  it('destroys focus trap on destroy', () => {
    component.ngOnDestroy();
    expect(focusTrap.destroy).toHaveBeenCalled();
  });
});
