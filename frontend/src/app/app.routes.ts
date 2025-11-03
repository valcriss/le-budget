import { Routes } from '@angular/router';
import { LoginPage } from './pages/login-page/login-page';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { Register } from './pages/register/register';
import { BudgetPage } from './pages/budget-page/budget-page';
import { AccountsPage } from './pages/accounts-page/accounts-page';
import { AccountPage } from './pages/account-page/account-page';
import { LandingPage } from './pages/landing-page/landing-page';
import {
  redirectIfAuthenticatedGuard,
  requireAuthGuard,
} from './core/auth/guards/auth.guards';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'login', component: LoginPage, canActivate: [redirectIfAuthenticatedGuard] },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'register', component: Register, canActivate: [redirectIfAuthenticatedGuard] },
  { path: 'budget', component: BudgetPage, canActivate: [requireAuthGuard] },
  { path: 'accounts', component: AccountsPage, canActivate: [requireAuthGuard] },
  { path: 'accounts/:id', component: AccountPage, canActivate: [requireAuthGuard] },
  { path: '**', redirectTo: '' },
];
