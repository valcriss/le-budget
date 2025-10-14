import { Routes } from '@angular/router';
import { LoginPage } from './pages/login-page/login-page';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { Register } from './pages/register/register';
import { BudgetPage } from './pages/budget-page/budget-page';

export const routes: Routes = [
    { path: 'login', component: LoginPage },
    { path: 'forgot-password', component: ForgotPassword },
    { path: 'register', component: Register },
    { path: 'budget', component: BudgetPage }
];
