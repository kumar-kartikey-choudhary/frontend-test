import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { ResetPassword } from './reset-password';

import { provideAppTesting } from '../../../testing';

describe('ResetPassword', () => {
  let fixture: ComponentFixture<ResetPassword>;
  let http: HttpTestingController;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;

  /** Creates the page and lets template-driven form controls register (they do so on a microtask). */
  async function create(token: string | null): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
      ],
      imports: [ResetPassword],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  async function fill(password: string, confirm: string): Promise<void> {
    for (const [id, value] of [['new-password', password], ['confirm-password', confirm]]) {
      const input = el().querySelector<HTMLInputElement>('#' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const submit = () => {
    el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('offers a fresh request instead of a form when the link has no token', async () => {
    await create(null);
    expect(el().textContent).toContain('incomplete');
    expect(el().querySelector('form')).toBeNull();
    expect(el().querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  it('takes the token out of the address bar once it has read it', async () => {
    await create('the-token');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { token: null },
      replaceUrl: true,
    }));
    expect(el().querySelector('form')).not.toBeNull();
  });

  it('sends nothing while the passwords are too short or do not match', async () => {
    await create('the-token');

    await fill('short', 'short');
    submit();
    await fill('long-enough-1', 'something-else');
    submit();

    http.expectNone((r) => r.url.endsWith('/users/reset-password'));
    expect(el().textContent).toContain("don't match");
  });

  it('sets the new password with the token and sends the customer to log in', async () => {
    await create('the-token');
    await fill('brand-new-pass', 'brand-new-pass');
    submit();

    const req = http.expectOne((r) => r.url.endsWith('/users/reset-password'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'the-token', newPassword: 'brand-new-pass' });
    req.flush(null);

    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { passwordReset: true } });
  });

  it('explains an expired or used link and offers a new one', async () => {
    await create('stale-token');
    await fill('brand-new-pass', 'brand-new-pass');
    submit();

    http.expectOne((r) => r.url.endsWith('/users/reset-password')).flush(
      { message: 'This reset link is invalid or has expired. Please request a new one.' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(el().textContent).toContain('invalid or has expired');
    expect(el().querySelector('form')).toBeNull();
    expect(el().querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  describe('choosing the password', () => {
    beforeEach(async () => create('tok'));

    it('rates the password and ticks off the rules as they are met', async () => {
      await fill('abc', '');
      expect(el().querySelector('.strength')!.textContent).toContain('Weak');
      expect(el().querySelectorAll('.rule--met').length).toBe(0);

      await fill('Str0ng-passw0rd!', 'Str0ng-passw0rd!');
      expect(el().querySelector('.strength')!.textContent).toContain('Strong');
      expect(el().querySelectorAll('.rule--met').length).toBe(3);
    });

    it('shows no strength meter before anything is typed', () => {
      expect(el().querySelector('.strength')).toBeNull();
    });
  });
});
