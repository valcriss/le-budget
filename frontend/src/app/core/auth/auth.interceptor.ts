import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { from, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { SKIP_AUTH_REFRESH } from './auth-http-context.tokens';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token = authStore.accessToken();

  const skipRefresh = req.context.get(SKIP_AUTH_REFRESH);
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        if (!skipRefresh) {
          return from(authStore.refreshAccessToken()).pipe(
            switchMap((success) => {
              if (!success) {
                authStore.logout();
                return throwError(() => error);
              }
              const refreshedToken = authStore.accessToken();
              if (!refreshedToken) {
                authStore.logout();
                return throwError(() => error);
              }
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${refreshedToken}`,
                },
                context: req.context.set(SKIP_AUTH_REFRESH, true),
              });
              return next(retryReq);
            }),
            catchError((refreshError) => {
              authStore.logout();
              return throwError(() => refreshError);
            }),
          );
        }

        authStore.logout();
      }

      return throwError(() => error);
    }),
  );
};
