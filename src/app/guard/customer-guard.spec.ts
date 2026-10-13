import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';

import { customerGuard } from './customer-guard';
import { AuthService } from '../service/login/auth-service';

import { provideAppTesting } from '../../testing';

function fakeJwt(expSecondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
  return `header.${payload}.signature`;
}

describe('customerGuard', () => {
  const run = () =>
    TestBed.runInInjectionContext(() =>
      customerGuard({} as ActivatedRouteSnapshot, { url: '/my-orders' } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  function configure(): void {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
  }

  it('sends a signed-out visitor to login and remembers where they were going', async () => {
    configure();
    const result = (await run()) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fmy-orders');
  });

  it('lets a signed-in user through', async () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
    configure();
    expect(await run()).toBeTrue();
  });

  it('waits for the reload-time token refresh instead of bouncing a still-signed-in user to login', async () => {
    sessionStorage.setItem('AUTH_TOKEN', fakeJwt(-60));
    sessionStorage.setItem('REFRESH_TOKEN', 'refresh-1');
    configure();
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService); // the session restore begins as the service is created

    const decision = run();
    await Promise.resolve();
    http.expectOne((r) => r.url.endsWith('/users/refresh-token'))
      .flush({ token: fakeJwt(3600), refreshToken: 'refresh-2', username: 'asha', role: 'ROLE_CUSTOMER' });

    expect(await decision).toBeTrue();
  });
});
