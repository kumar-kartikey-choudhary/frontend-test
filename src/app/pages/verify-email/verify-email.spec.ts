import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideAppTesting } from '../../../testing';
import { AuthService } from '../../service/login/auth-service';
import { VerifyEmail } from './verify-email';

describe('VerifyEmail', () => {
  let fixture: ComponentFixture<VerifyEmail>;
  let http: HttpTestingController;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;

  function create(token: string | null, loggedIn = false): void {
    TestBed.configureTestingModule({
      imports: [VerifyEmail],
      providers: [
        ...provideAppTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(TestBed.inject(AuthService), 'isLoggedIn').and.returnValue(loggedIn);
    fixture = TestBed.createComponent(VerifyEmail);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('confirms the address using the token and removes it from the address bar', () => {
    create('the-token');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { token: null }, replaceUrl: true }));
    expect(el().textContent).toContain('Checking your link');

    const req = http.expectOne((r) => r.url.endsWith('/users/verify-email'));
    expect(req.request.body).toEqual({ token: 'the-token' });
    req.flush(null);
    fixture.detectChanges();

    expect(el().textContent).toContain('your email address is confirmed');
    expect(el().querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('sends a signed-in customer on to their account', () => {
    create('the-token', true);
    http.expectOne((r) => r.url.endsWith('/users/verify-email')).flush(null);
    fixture.detectChanges();
    expect(el().querySelector('a[href="/account"]')).not.toBeNull();
  });

  it('explains an expired or used link, and offers a new one to a signed-in customer', () => {
    create('stale', true);
    http.expectOne((r) => r.url.endsWith('/users/verify-email'))
      .flush({ message: 'This verification link is invalid or has expired. Please request a new one.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el().textContent).toContain('invalid or has expired');
    (el().querySelector('button.btn-submit') as HTMLButtonElement).click();
    http.expectOne((r) => r.url.endsWith('/users/resend-verification')).flush(null);
  });

  it('tells a signed-out visitor to log in for a new link', () => {
    create('stale', false);
    http.expectOne((r) => r.url.endsWith('/users/verify-email')).flush({ message: 'expired' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Log in to your account');
    expect(el().querySelector('button.btn-submit')).toBeNull();
  });

  it('copes with a link that has no token', () => {
    create(null);
    expect(el().textContent).toContain('incomplete');
  });
});
