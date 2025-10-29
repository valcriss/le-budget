import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faFacebookF, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrls: ['./login-page.css'],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly library = inject(FaIconLibrary);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authStore = inject(AuthStore);

  protected readonly faGoogle = faGoogle;
  protected readonly faFacebook = faFacebookF;
  protected readonly faLogin = faRightToBracket;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly loading = this.authStore.loading;
  readonly error = this.authStore.error;

  constructor() {
    this.library.addIcons(faGoogle, faFacebookF, faRightToBracket);
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.error()) {
        this.authStore.clearError();
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const success = await this.authStore.login(this.form.getRawValue());
    if (!success) {
      this.form.setErrors({ submitFailed: true });
      return;
    }
    this.form.reset();
  }

  onGoogleSignIn(): void {
    console.info('Authentification Google non implémentée.');
  }

  onFacebookSignIn(): void {
    console.info('Authentification Facebook non implémentée.');
  }
}
