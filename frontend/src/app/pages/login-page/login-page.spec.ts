import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthStore } from '../../core/auth/auth.store';
import { LoginPage } from './login-page';

class AuthStoreStub {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly login = jasmine.createSpy('login').and.returnValue(Promise.resolve(true));
  readonly clearError = jasmine.createSpy('clearError');
}

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [{ provide: AuthStore, useClass: AuthStoreStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
