import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthStore } from '../auth.store';

function redirectToLogin(url: string): UrlTree {
  const router = inject(Router);
  return router.createUrlTree(['/login'], { queryParams: { redirect: url } });
}

function redirectToBudget(): UrlTree {
  const router = inject(Router);
  return router.createUrlTree(['/budget']);
}

export const requireAuthGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const isAuthenticated = authStore.isAuthenticated();
  if (isAuthenticated) {
    return true;
  }
  const targetUrl = state.url;
  return redirectToLogin(targetUrl);
};

export const redirectIfAuthenticatedGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  return authStore.isAuthenticated() ? redirectToBudget() : true;
};
