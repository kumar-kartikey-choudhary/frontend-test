import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor, isOwnApiRequest } from './auth.interceptor';
import { environment } from '../../environments/environment';
import { AuthService } from '../service/login/auth-service';

function fakeJwt(expSecondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
  return `header.${payload}.signature`;
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('refreshes the token on a 401 and replays the request with the new one', () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    setup();

    let body: unknown;
    http.get('/orders/findByCustomer').subscribe((b) => (body = b));
    backend.expectOne('/orders/findByCustomer').flush({ message: 'Please sign in to continue.' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne((r) => r.url.endsWith('/users/refresh-token'));
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush({ token: 'fresh-token', refreshToken: 'refresh-2', username: 'asha', role: 'ROLE_CUSTOMER' });

    const retried = backend.expectOne('/orders/findByCustomer');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retried.flush(['order']);
    expect(body).toEqual(['order']);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('signs the user out and sends them to login only when the refresh itself fails', () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'revoked');
    setup();

    let failed = false;
    http.get('/orders/findByCustomer').subscribe({ error: () => (failed = true) });
    backend.expectOne('/orders/findByCustomer').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne((r) => r.url.endsWith('/users/refresh-token')).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBeTrue();
    expect(auth.isLoggedIn()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], jasmine.objectContaining({ queryParams: jasmine.objectContaining({ sessionExpired: true }) }));
  });

  it('does NOT sign the user out when the retried request fails for an ordinary reason', () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    setup();

    let status = 0;
    http.get('/orders/findByCustomer').subscribe({ error: (e) => (status = e.status) });
    backend.expectOne('/orders/findByCustomer').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne((r) => r.url.endsWith('/users/refresh-token'))
      .flush({ token: fakeJwt(3600), refreshToken: 'refresh-2', username: 'asha', role: 'ROLE_CUSTOMER' });
    backend.expectOne('/orders/findByCustomer').flush({ message: 'conflict' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
    expect(auth.isLoggedIn()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shares one refresh between requests that fail together (refresh tokens are single-use)', () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    setup();

    const results: unknown[] = [];
    http.get('/orders/findByCustomer').subscribe((b) => results.push(b));
    http.get('/carts').subscribe((b) => results.push(b));
    backend.expectOne('/orders/findByCustomer').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/carts').flush({}, { status: 401, statusText: 'Unauthorized' });

    // Exactly one refresh call, not one per failed request.
    backend.expectOne((r) => r.url.endsWith('/users/refresh-token'))
      .flush({ token: 'fresh', refreshToken: 'refresh-2', username: 'asha', role: 'ROLE_CUSTOMER' });
    backend.expectOne('/orders/findByCustomer').flush(['o']);
    backend.expectOne('/carts').flush(['c']);

    expect(results).toEqual([['o'], ['c']]);
    expect(auth.isLoggedIn()).toBeTrue();
  });

  it('shows a permission message, without refreshing or logging out, on a 403', () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    setup();

    http.get('/products/admin/p1/ledger').subscribe({ error: () => undefined });
    backend.expectOne('/products/admin/p1/ledger').flush({}, { status: 403, statusText: 'Forbidden' });

    backend.expectNone((r) => r.url.endsWith('/users/refresh-token'));
    expect(auth.isLoggedIn()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('leaves a wrong-password 401 on /users/login alone', () => {
    setup();

    let status = 0;
    http.post('/users/login', {}).subscribe({ error: (e) => (status = e.status) });
    backend.expectOne('/users/login').flush({ message: 'Invalid username or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  describe('where the token goes', () => {
    it('sends it to our own API', () => {
      sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
      setup();
      http.get(`${environment.apiBaseUrl}/orders/findByCustomer`).subscribe();
      const req = backend.expectOne(`${environment.apiBaseUrl}/orders/findByCustomer`);
      expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
      req.flush([]);
    });

    it('never sends it to another site', () => {
      sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
      setup();
      http.get('https://third-party.example/pixel').subscribe();
      const req = backend.expectOne('https://third-party.example/pixel');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('does not sign the user out because some other site said 401', () => {
      sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
      sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
      setup();
      http.get('https://third-party.example/pixel').subscribe({ error: () => {} });
      backend.expectOne('https://third-party.example/pixel').flush({}, { status: 401, statusText: 'Unauthorized' });
      backend.expectNone((r) => r.url.endsWith('/users/refresh-token'));
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('treats a look-alike host as another site', () => {
      expect(isOwnApiRequest(`${environment.apiBaseUrl}.evil.example/x`)).toBeFalse();
      expect(isOwnApiRequest('https://api.pratikdairy.com@evil.example/x')).toBeFalse();
      expect(isOwnApiRequest('/orders/1')).toBeTrue();
    });
  });
});
