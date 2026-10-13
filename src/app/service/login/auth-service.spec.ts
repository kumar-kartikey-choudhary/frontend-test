import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService, JwtResponse } from './auth-service';

function fakeJwt(expSecondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
  return `header.${payload}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts signed out', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.isAdmin()).toBeFalse();
  });

  it('stores the session and exposes the role after login', () => {
    const response: JwtResponse = {
      token: fakeJwt(3600),
      refreshToken: 'refresh-token',
      username: 'kartikey',
      role: 'ROLE_ADMIN',
    };

    service.login({ username: 'kartikey', password: 'secret' }).subscribe();
    http.expectOne((r) => r.url.endsWith('/users/login')).flush(response);

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.isAdmin()).toBeTrue();
    expect(service.getUserInitial()).toBe('K');
  });

  it('treats an expired token as signed out', () => {
    expect(service.isTokenExpired(fakeJwt(-10))).toBeTrue();
    expect(service.isTokenExpired(fakeJwt(3600))).toBeFalse();
  });

  it('clears everything on logout', () => {
    service.login({ username: 'a', password: 'b' }).subscribe();
    http
      .expectOne((r) => r.url.endsWith('/users/login'))
      .flush({
        token: fakeJwt(3600),
        refreshToken: 'refresh-token',
        username: 'a',
        role: 'ROLE_CUSTOMER',
      });

    service.logout();

    // Logging out also revokes the refresh token server-side (best effort).
    http.expectOne((r) => r.url.endsWith('/users/logout')).flush({});

    expect(service.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('AUTH_TOKEN')).toBeNull();
    expect(sessionStorage.getItem('REFRESH_TOKEN')).toBeNull();
  });
});


describe('AuthService - restoring a session on reload', () => {
  let http: HttpTestingController;

  function createService(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('takes the role from the token, not from an entry anyone can edit in the browser', () => {
    const payload = btoa(JSON.stringify({ sub: 'asha', role: 'ROLE_CUSTOMER', exp: Math.floor(Date.now() / 1000) + 3600 }));
    sessionStorage.setItem('AUTH_TOKEN', `header.${payload}.signature`);
    sessionStorage.setItem('USER_ROLE', 'ROLE_ADMIN'); // tampered
    sessionStorage.setItem('USERNAME', 'someone-else'); // tampered

    const auth = createService();

    expect(auth.admin()).toBeFalse();
    expect(auth.getUserRole()).toBe('ROLE_CUSTOMER');
    expect(auth.username()).toBe('asha');
  });

  it('uses the refresh token to restore the session when the access token expired while the tab was closed', async () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(-60));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    const service = createService();
    expect(service.isLoggedIn()).toBeFalse(); // not yet - the refresh is on its way

    await Promise.resolve(); // the refresh starts one tick after construction
    const refresh = http.expectOne((r) => r.url.endsWith('/users/refresh-token'));
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    const ready = service.whenSessionReady();
    refresh.flush({ token: fakeJwt(3600), refreshToken: 'refresh-2', username: 'asha', role: 'ROLE_CUSTOMER' });
    await ready;

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getUsername()).toBe('asha');
    expect(sessionStorage.getItem('REFRESH_TOKEN')).toBe('refresh-2');
  });

  it('quietly signs out - without redirecting - when the refresh token is no longer good', async () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(-60));
    sessionStorage.setItem('REFRESH_TOKEN', 'revoked');
    const service = createService();

    await Promise.resolve();
    const ready = service.whenSessionReady();
    http.expectOne((r) => r.url.endsWith('/users/refresh-token')).flush({}, { status: 401, statusText: 'Unauthorized' });
    await ready;

    expect(service.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('REFRESH_TOKEN')).toBeNull();
    http.verify(); // no logout call, nothing else sent
  });

  it('does nothing for a visitor who was never signed in', async () => {
    const service = createService();
    await Promise.resolve();
    await service.whenSessionReady();
    http.verify();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('does not refresh when the access token is still good', async () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    const service = createService();
    await Promise.resolve();
    http.verify();
    expect(service.isLoggedIn()).toBeTrue();
  });

  it('sends a single refresh request however many callers ask at once', () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    const service = createService();

    const results: string[] = [];
    service.refreshToken().subscribe((r) => results.push(r.token));
    service.refreshToken().subscribe((r) => results.push(r.token));
    http.expectOne((r) => r.url.endsWith('/users/refresh-token'))
      .flush({ token: 'fresh', refreshToken: 'refresh-2', username: 'asha', role: 'ROLE_CUSTOMER' });

    expect(results).toEqual(['fresh', 'fresh']);

    // Once finished, the next refresh is a new request again.
    service.refreshToken().subscribe();
    http.expectOne((r) => r.url.endsWith('/users/refresh-token')).flush(
      { token: 'fresher', refreshToken: 'refresh-3', username: 'asha', role: 'ROLE_CUSTOMER' });
  });
});


describe('AuthService - changing the password', () => {
  it('stores the fresh tokens the server returns so this session carries on', () => {
    sessionStorage.clear();
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'old-refresh');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(AuthService);

    service.changePassword('old-password', 'new-password-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/users/change-password'));
    expect(req.request.body).toEqual({ currentPassword: 'old-password', newPassword: 'new-password-1' });
    req.flush({ token: 'new-access', refreshToken: 'new-refresh', username: 'asha', role: 'ROLE_CUSTOMER' });

    expect(service.getToken()).toBe('new-access');
    expect(sessionStorage.getItem('REFRESH_TOKEN')).toBe('new-refresh');
    expect(service.isLoggedIn()).toBeTrue();
    sessionStorage.clear();
  });
});


describe('AuthService - forgot password', () => {
  it('posts the email, and later the token with the new password, to the public reset endpoints', () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(AuthService);

    service.requestPasswordReset('asha@example.com').subscribe();
    const forgot = http.expectOne((r) => r.url.endsWith('/users/forgot-password'));
    expect(forgot.request.method).toBe('POST');
    expect(forgot.request.body).toEqual({ email: 'asha@example.com' });
    forgot.flush(null);

    service.resetPassword('the-token', 'brand-new-pass').subscribe();
    const reset = http.expectOne((r) => r.url.endsWith('/users/reset-password'));
    expect(reset.request.body).toEqual({ token: 'the-token', newPassword: 'brand-new-pass' });
    reset.flush(null);

    expect(service.isLoggedIn()).toBeFalse(); // resetting a password does not sign anyone in
  });
});


describe('AuthService - deleting the account', () => {
  it('posts the password and then signs out locally without calling logout', () => {
    sessionStorage.clear();
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(AuthService);
    expect(service.isLoggedIn()).toBeTrue();

    service.deleteAccount('my-password').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/users/delete-account'));
    expect(req.request.body).toEqual({ password: 'my-password' });
    req.flush(null);

    expect(service.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('REFRESH_TOKEN')).toBeNull();
    http.expectNone((r) => r.url.endsWith('/users/logout'));   // the server already ended every session
    http.verify();
  });
});
