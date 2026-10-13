import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../service/login/auth-service';
import { StorageService } from '../core/services/storage.service';
import { ToastService } from '../core/services/toast.service';

/**
 * Attaches the bearer token and handles auth failures.
 *
 * On a 401 from an already-expired-looking token, tries a silent refresh
 * (POST /users/refresh-token) once and retries the original request with the
 * new access token, rather than immediately booting the user to /login. Only
 * forces a logout if the refresh itself fails (refresh token expired/revoked)
 * or there was no refresh token to try. The refresh-token/login endpoints
 * themselves are excluded, so a failed login attempt can't trigger a refresh
 * loop.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const storage = inject(StorageService);
  const toast = inject(ToastService);

  const isAuthEndpoint = req.url.includes('/users/login') || req.url.includes('/users/refresh-token');

  let request = req;

  if (storage.isBrowser && !isAuthEndpoint) {
    const token = authService.getToken();
    if (token && !authService.isTokenExpired(token)) {
      request = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint && authService.hasRefreshToken()) {
        return authService.refreshToken().pipe(
          // Only a failed *refresh* ends the session. This sits before the retry so an ordinary error
          // from the retried request (a 409, a 500 ...) reaches the caller instead of logging the user out.
          catchError((refreshError) => {
            authService.logout();
            router.navigate(['/login'], {
              queryParams: { sessionExpired: true, returnUrl: router.url },
            });
            return throwError(() => refreshError);
          }),
          switchMap((refreshed) => {
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${refreshed.token}` } });
            return next(retried);
          }),
        );
      }

      // Login and refresh failures are handled by their callers (a wrong password is just an error
      // message; a failed refresh logs out below, or quietly at start-up) - don't also redirect here.
      if (error.status === 401 && !isAuthEndpoint) {
        authService.logout();
        router.navigate(['/login'], {
          queryParams: { sessionExpired: true, returnUrl: router.url },
        });
      } else if (error.status === 403) {
        toast.error('You do not have permission to perform this action.');
      }
      return throwError(() => error);
    }),
  );
};