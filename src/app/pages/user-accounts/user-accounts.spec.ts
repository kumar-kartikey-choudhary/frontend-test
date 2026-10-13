import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { UserAccounts } from './user-accounts';

import { provideAppTesting } from '../../../testing';
import { Router } from '@angular/router';
import { ConfirmService } from '../../core/services/confirm.service';

function fakeJwt(expSecondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
  return `header.${payload}.signature`;
}

describe('UserAccounts', () => {
  let component: UserAccounts;
  let fixture: ComponentFixture<UserAccounts>;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [UserAccounts],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserAccounts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => sessionStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('changing the password', () => {
    const el = () => fixture.nativeElement as HTMLElement;

    async function openPasswordTab(): Promise<void> {
      const tab = Array.from(el().querySelectorAll<HTMLButtonElement>('.tab-btn')).find((b) =>
        b.textContent!.includes('Password'),
      );
      tab!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    async function fill(current: string, next: string, confirm: string): Promise<void> {
      for (const [id, value] of [['pw-current', current], ['pw-new', next], ['pw-confirm', confirm]]) {
        const input = el().querySelector<HTMLInputElement>('#' + id)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
      fixture.detectChanges();
      await fixture.whenStable();
    }

    const submit = () => {
      el().querySelector<HTMLFormElement>('#panel-security form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };

    it('has its own tab', async () => {
      await openPasswordTab();
      expect(el().querySelector('#panel-security')).not.toBeNull();
      expect(el().textContent).toContain('Change password');
    });

    it('sends nothing while the form is invalid (mismatch, too short, or unchanged)', async () => {
      await openPasswordTab();

      await fill('old-password', 'new-password-1', 'something-else');
      submit();
      expect(el().textContent).toContain("don't match");

      await fill('old-password', 'short', 'short');
      submit();

      await fill('same-password', 'same-password', 'same-password');
      submit();
      expect(el().textContent).toContain('must be different');

      http.expectNone((r) => r.url.endsWith('/users/change-password'));
    });

    it('changes the password and keeps the user signed in with the fresh tokens', async () => {
      sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
      sessionStorage.setItem('REFRESH_TOKEN', 'old-refresh');
      await openPasswordTab();

      await fill('old-password', 'new-password-1', 'new-password-1');
      submit();

      const req = http.expectOne((r) => r.url.endsWith('/users/change-password'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ currentPassword: 'old-password', newPassword: 'new-password-1' });
      req.flush({ token: 'new-access', refreshToken: 'new-refresh', username: 'asha', role: 'ROLE_CUSTOMER' });
      fixture.detectChanges();

      expect(sessionStorage.getItem('AUTH_TOKEN')).toBe('new-access');
      expect(sessionStorage.getItem('REFRESH_TOKEN')).toBe('new-refresh');
      expect((el().querySelector('#pw-current') as HTMLInputElement).value).toBe('');
    });

    it('leaves the session alone when the current password is wrong', async () => {
      sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
      sessionStorage.setItem('REFRESH_TOKEN', 'old-refresh');
      await openPasswordTab();

      await fill('wrong-password', 'new-password-1', 'new-password-1');
      submit();
      http.expectOne((r) => r.url.endsWith('/users/change-password'))
        .flush({ message: 'Your current password is incorrect.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(sessionStorage.getItem('REFRESH_TOKEN')).toBe('old-refresh');
      expect((el().querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBeFalse();
    });
  });

  describe('email confirmation', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const profile = (emailVerified: boolean) => ({
      id: 'u1', firstName: 'Asha', lastName: 'Verma', username: 'asha', email: 'asha@example.com', role: 'CUSTOMER', emailVerified,
    });

    it('shows a confirmed address as confirmed', () => {
      http.expectOne((r) => r.url.endsWith('/users/me')).flush(profile(true));
      fixture.detectChanges();
      expect(el().textContent).toContain('✓ Confirmed');
      expect(el().textContent).not.toContain('Send me the email');
    });

    it('lets the customer ask for the confirmation email again', () => {
      http.expectOne((r) => r.url.endsWith('/users/me')).flush(profile(false));
      fixture.detectChanges();
      expect(el().textContent).toContain('Not confirmed yet');

      (el().querySelector('.unverified .btn-link') as HTMLButtonElement).click();
      http.expectOne((r) => r.url.endsWith('/users/resend-verification')).flush(null);
    });
  });

  describe('deleting the account', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    let router: Router;
    let confirm: ConfirmService;

    async function openDangerZone(): Promise<void> {
      const tab = Array.from(el().querySelectorAll<HTMLButtonElement>('.tab-btn')).find((b) => b.textContent!.includes('Password'));
      tab!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      (el().querySelector('.danger-zone .btn-delete') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    async function typePassword(value: string): Promise<void> {
      const input = el().querySelector<HTMLInputElement>('#delete-password')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
    }

    const submit = () => {
      el().querySelector<HTMLFormElement>('.danger-zone form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };

    beforeEach(() => {
      router = TestBed.inject(Router);
      confirm = TestBed.inject(ConfirmService);
      spyOn(router, 'navigate').and.resolveTo(true);
    });

    it('asks for the password first and does nothing without it', async () => {
      await openDangerZone();
      expect((el().querySelector('.danger-zone form .btn-delete') as HTMLButtonElement).disabled).toBeTrue();
      http.expectNone((r) => r.url.endsWith('/users/delete-account'));
    });

    it('does not delete if the customer backs out of the confirmation', async () => {
      spyOn(confirm, 'confirm').and.resolveTo(false);
      await openDangerZone();
      await typePassword('my-password');
      submit();
      await fixture.whenStable();

      http.expectNone((r) => r.url.endsWith('/users/delete-account'));
    });

    it('deletes after confirmation, signs the customer out and goes home', async () => {
      sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
      sessionStorage.setItem('REFRESH_TOKEN', 'r1');
      spyOn(confirm, 'confirm').and.resolveTo(true);
      await openDangerZone();
      await typePassword('my-password');
      submit();
      await fixture.whenStable();

      const req = http.expectOne((r) => r.url.endsWith('/users/delete-account'));
      expect(req.request.body).toEqual({ password: 'my-password' });
      req.flush(null);

      expect(sessionStorage.getItem('AUTH_TOKEN')).toBeNull();
      expect(sessionStorage.getItem('REFRESH_TOKEN')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('stays signed in when the password is wrong', async () => {
      sessionStorage.setItem('AUTH_TOKEN', fakeJwt(3600));
      sessionStorage.setItem('REFRESH_TOKEN', 'r1');
      spyOn(confirm, 'confirm').and.resolveTo(true);
      await openDangerZone();
      await typePassword('wrong');
      submit();
      await fixture.whenStable();

      http.expectOne((r) => r.url.endsWith('/users/delete-account'))
        .flush({ message: 'Your password is incorrect.' }, { status: 400, statusText: 'Bad Request' });

      expect(sessionStorage.getItem('REFRESH_TOKEN')).toBe('r1');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
