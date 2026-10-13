import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import { AuthService } from '../login/auth-service';
import { WishlistService } from './wishlist-service';

function fakeJwt(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.signature`;
}

describe('WishlistService', () => {
  let service: WishlistService;
  let http: HttpTestingController;
  let auth: AuthService;

  /** Signs a customer in the way the app does, so the service loads their saved ids. */
  function signIn(ids: string[]): void {
    auth.login({ username: 'asha', password: 'x' }).subscribe();
    http.expectOne((r) => r.url.endsWith('/users/login')).flush({ token: fakeJwt(), refreshToken: 'r', username: 'asha', role: 'ROLE_CUSTOMER' });
    TestBed.tick();   // let the effect notice the new session
    http.expectOne((r) => r.url.endsWith('/products/wishlist/ids')).flush(ids);
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    service = TestBed.inject(WishlistService);
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('loads the saved ids when someone signs in', () => {
    expect(service.count()).toBe(0);
    signIn(['p1', 'p2']);
    expect(service.isSaved('p1')).toBeTrue();
    expect(service.isSaved('p3')).toBeFalse();
    expect(service.count()).toBe(2);
  });

  it('forgets everything when they sign out', () => {
    signIn(['p1']);
    auth.logout();
    http.expectOne((r) => r.url.endsWith('/users/logout')).flush({});
    TestBed.tick();
    expect(service.count()).toBe(0);
  });

  it('saves a product at once and tells the server', () => {
    signIn([]);
    service.toggle('p1');
    expect(service.isSaved('p1')).toBeTrue();   // the heart is filled before the server answers
    const req = http.expectOne((r) => r.url.endsWith('/products/wishlist/p1'));
    expect(req.request.method).toBe('POST');
    req.flush(null);
    expect(service.isBusy('p1')).toBeFalse();
  });

  it('removes a saved product', () => {
    signIn(['p1']);
    service.toggle('p1');
    expect(service.isSaved('p1')).toBeFalse();
    const req = http.expectOne((r) => r.url.endsWith('/products/wishlist/p1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('puts the heart back if the server refuses', () => {
    signIn([]);
    service.toggle('p1');
    http.expectOne((r) => r.url.endsWith('/products/wishlist/p1')).flush({}, { status: 404, statusText: 'Not Found' });
    expect(service.isSaved('p1')).toBeFalse();
    expect(service.isBusy('p1')).toBeFalse();
  });

  it('ignores a second tap while the first is still being saved', () => {
    signIn([]);
    service.toggle('p1');
    service.toggle('p1');
    http.expectOne((r) => r.url.endsWith('/products/wishlist/p1')).flush(null);   // exactly one request
    expect(service.isSaved('p1')).toBeTrue();
  });

  it('the wishlist page list also refreshes which ids are saved', () => {
    signIn([]);
    service.list().subscribe();
    http.expectOne((r) => r.url.endsWith('/products/wishlist') && r.method === 'GET').flush([{ id: 'p9' }, { id: 'p8' }]);
    expect(service.count()).toBe(2);
  });
});
