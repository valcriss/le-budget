import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { LoginPage } from './login-page';

class AuthStoreStub {
  readonly loading = signal(false);
  readonly error: WritableSignal<string | null> = signal(null);
  readonly login = jest.fn().mockName('login').mockResolvedValue(true);
  readonly clearError = jest.fn().mockName('clearError');
}

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authStore: AuthStoreStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: AuthStore, useClass: AuthStoreStub },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        provideRouter([]),
      ],
    }).compileComponents();

    authStore = TestBed.inject(AuthStore) as unknown as AuthStoreStub;
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('marks fields as touched when submitting invalid form', async () => {
    expect(component.form.valid).toBe(false);
    expect(component.form.controls.email.touched).toBe(false);

    await component.onSubmit();

    expect(component.form.controls.email.touched).toBe(true);
    expect(authStore.login).not.toHaveBeenCalled();
  });

  it('calls login and resets form on success', async () => {
    component.form.setValue({ email: 'user@example.com', password: 'password!' });

    await component.onSubmit();

    expect(authStore.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password!',
    });
    expect(component.form.value).toEqual({ email: '', password: '' });
  });

  it('flags submit error when login fails', async () => {
    authStore.login.mockResolvedValueOnce(false);
    component.form.setValue({ email: 'user@example.com', password: 'password!' });

    await component.onSubmit();

    expect(component.form.errors).toEqual({ submitFailed: true });
  });

  it('clears store error when form changes', () => {
    authStore.error.set('Erreur');
    component.form.controls.email.setValue('new@example.com');

    expect(authStore.clearError).toHaveBeenCalled();
  });

  it('logs to console for social sign-in actions', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    component.onGoogleSignIn();
    component.onFacebookSignIn();

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
