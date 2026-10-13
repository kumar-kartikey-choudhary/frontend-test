import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, firstValueFrom, shareReplay, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { StorageService } from '../../core/services/storage.service';
import type { LoginRequest, JwtResponse, AuthState, RefreshTokenResponse } from '../../model';

export type { LoginRequest, JwtResponse, AuthState };

const TOKEN_KEY = 'AUTH_TOKEN';
const REFRESH_TOKEN_KEY = 'REFRESH_TOKEN';
const USER_ROLE_KEY = 'USER_ROLE';
const USERNAME_KEY = 'USERNAME';

/** Decodes the payload of a JWT without verifying it (verification is the API's job). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalised = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalised)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  private readonly authApiUrl = `${environment.apiBaseUrl}/users`;

  /**
   * Reactive auth state. Components can read `auth.state()` / `auth.isAdmin()`
   * and the UI updates immediately after login or logout — previously the
   * header only refreshed on a full page reload.
   */
  private readonly _state = signal<AuthState | null>(null);
  readonly state = this._state.asReadonly();
  readonly loggedIn = computed(() => this._state() !== null);
  readonly username = computed(() => this._state()?.username ?? null);
  readonly role = computed(() => this._state()?.role ?? null);
  readonly admin = computed(() => this._state()?.role === 'ROLE_ADMIN');
  readonly initial = computed(() => {
    const name = this._state()?.username;
    return name ? name.charAt(0).toUpperCase() : '👤';
  });

  /** The start-up refresh, while one is running - see {@link whenSessionReady}. */
  private pendingRefresh: Promise<void> | null = null;

  constructor() {
    this.restoreSession();
    this.refreshExpiredSessionInBackground();
  }

  // ---------------------------------------------------------------- session

  private restoreSession(): void {
    const token = this.storage.get(TOKEN_KEY);
    if (!token || this.isTokenExpired(token)) {
      // Don't clear the refresh token here - a still-valid refresh token lets
      // the interceptor silently mint a new access token on the next request
      // instead of forcing a full re-login. Only clearStorage() (explicit
      // logout, or a failed refresh) removes it.
      this.storage.remove(TOKEN_KEY);
      this.storage.remove(USER_ROLE_KEY);
      this.storage.remove(USERNAME_KEY);
      return;
    }
    this._state.set({
      token,
      username: this.storage.get(USERNAME_KEY) ?? '',
      role: this.storage.get(USER_ROLE_KEY) ?? '',
    });
  }

  /** A token that is present but expired is worse than no token at all. */
  /**
   * After a reload with an expired access token but a still-valid refresh token, quietly get a new
   * access token instead of showing the user as signed out. Deferred a tick because the HTTP
   * interceptors inject this service: calling out from the constructor would be a circular dependency.
   */
  private refreshExpiredSessionInBackground(): void {
    if (!this.storage.isBrowser || this._state() !== null || !this.hasRefreshToken()) return;
    this.pendingRefresh = Promise.resolve()
      .then(() => firstValueFrom(this.refreshToken()))
      .then(() => undefined)
      .catch(() => this.clearStorage()) // refresh token expired or revoked: genuinely signed out
      .finally(() => (this.pendingRefresh = null));
  }

  /** Resolves once any start-up session refresh has finished, so route guards don't act on a half-restored session. */
  whenSessionReady(): Promise<void> {
    return this.pendingRefresh ?? Promise.resolve();
  }

  isTokenExpired(token = this.getToken()): boolean {
    if (!token) return true;
    const payload = decodeJwt(token);
    const exp = payload?.['exp'];
    if (typeof exp !== 'number') return false; // no exp claim -> let the API decide
    return Date.now() >= exp * 1000 - environment.tokenExpiryLeewayMs;
  }

  // ------------------------------------------------------------------- auth

  login(credentials: LoginRequest): Observable<JwtResponse> {
    return this.http
      .post<JwtResponse>(`${this.authApiUrl}/login`, credentials)
      .pipe(tap((response) => this.saveAuthData(response)));
  }

  private saveAuthData(response: JwtResponse): void {
    this.storage.set(TOKEN_KEY, response.token);
    this.storage.set(REFRESH_TOKEN_KEY, response.refreshToken);
    this.storage.set(USER_ROLE_KEY, response.role);
    this.storage.set(USERNAME_KEY, response.username);
    this._state.set({
      token: response.token,
      username: response.username,
      role: response.role,
    });
  }

  /**
   * Exchanges the stored refresh token for a new access token, rotating the
   * refresh token in the process (the backend revokes the old one - see
   * UserServiceImpl.refreshAccessToken()). Called by the auth interceptor on
   * a 401, not normally something components call directly.
   */
  refreshToken(): Observable<RefreshTokenResponse> {
    // One refresh at a time. Refresh tokens are single-use, so when several requests find the access
    // token expired together they must share one refresh: a second call would present the token the
    // first just revoked and the server would reject it, signing the user out.
    if (!this.refreshInFlight) {
      const refreshToken = this.storage.get(REFRESH_TOKEN_KEY);
      this.refreshInFlight = this.http
        .post<RefreshTokenResponse>(`${this.authApiUrl}/refresh-token`, { refreshToken })
        .pipe(
          tap((response) => this.storeSession(response)),
          finalize(() => (this.refreshInFlight = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refreshInFlight;
  }

  private refreshInFlight: Observable<RefreshTokenResponse> | null = null;

  private storeSession(response: RefreshTokenResponse): void {
    this.storage.set(TOKEN_KEY, response.token);
    this.storage.set(REFRESH_TOKEN_KEY, response.refreshToken);
    this._state.set({ token: response.token, username: response.username, role: response.role });
  }

  /**
   * Deletes the signed-in customer's own account (after re-checking their password). The server ends every
   * session, so this signs out locally without trying to call logout for a refresh token that no longer exists.
   */
  deleteAccount(password: string): Observable<void> {
    return this.http.post<void>(`${this.authApiUrl}/delete-account`, { password }).pipe(
      tap(() => {
        this.clearStorage();
        this._state.set(null);
      }),
    );
  }

  /** Asks the server to email a reset link. It answers the same way whether or not the address has an account. */
  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${this.authApiUrl}/forgot-password`, { email });
  }

  /** Sets a new password using the token from the emailed link (single use, expires). */
  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.authApiUrl}/reset-password`, { token, newPassword });
  }

  /**
   * Changes the signed-in user's own password. The server checks the current one, signs every other
   * session out, and returns fresh tokens for this session, which are stored so the user stays signed in.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<RefreshTokenResponse> {
    return this.http
      .post<RefreshTokenResponse>(`${this.authApiUrl}/change-password`, { currentPassword, newPassword })
      .pipe(tap((response) => this.storeSession(response)));
  }

  hasRefreshToken(): boolean {
    return !!this.storage.get(REFRESH_TOKEN_KEY);
  }

  logout(redirect = false): void {
    const refreshToken = this.storage.get(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      // Best-effort - revokes the session server-side so the refresh token can't be reused,
      // but logout proceeds locally either way (e.g. if the network call fails).
      this.http.post(`${this.authApiUrl}/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
    this.clearStorage();
    this._state.set(null);
    if (redirect) this.router.navigate(['/login']);
  }

  private clearStorage(): void {
    [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ROLE_KEY, USERNAME_KEY].forEach((k) => this.storage.remove(k));
  }

  /**
   * Sends the user to the page they originally requested, falling back to a
   * role-appropriate landing page.
   */
  navigateAfterLogin(returnUrl?: string | null): void {
    if (returnUrl && returnUrl !== '/login' && returnUrl !== '/signup') {
      this.router.navigateByUrl(returnUrl);
      return;
    }
    this.router.navigate([this.admin() ? '/admin/dashboard' : '/home']);
  }

  /** @deprecated kept for backwards compatibility — use navigateAfterLogin(). */
  navigateBasedOnRole(): void {
    this.navigateAfterLogin(null);
  }

  // --------------------------------------------------------- legacy getters
  // Existing components call these as methods from templates; they now read
  // from the signal so change detection stays correct.

  getToken(): string | null {
    return this._state()?.token ?? this.storage.get(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return this.loggedIn();
  }

  isAdmin(): boolean {
    return this.admin();
  }

  getUserRole(): string | null {
    return this.role();
  }

  getUsername(): string | null {
    return this.username();
  }

  getUserInitial(): string {
    return this.initial();
  }
}