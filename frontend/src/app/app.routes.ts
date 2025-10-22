import { Routes } from '@angular/router';
import { LoginPage } from './pages/login-page/login-page';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { Register } from './pages/register/register';
import { BudgetPage } from './pages/budget-page/budget-page';
import { AccountsPage } from './pages/accounts-page/accounts-page';
import { AccountPage } from './pages/account-page/account-page';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'register', component: Register },
  { path: 'budget', component: BudgetPage },
  { path: 'accounts', component: AccountsPage },
  { path: 'accounts/:id', component: AccountPage },
];
