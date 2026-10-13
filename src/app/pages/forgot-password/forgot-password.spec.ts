import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ForgotPassword } from './forgot-password';

import { provideAppTesting } from '../../../testing';

describe('ForgotPassword', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ providers: provideAppTesting(), imports: [ForgotPassword] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function submitWith(email: string): Promise<void> {
    const input = el().querySelector<HTMLInputElement>('#email')!;
    input.value = email;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('asks for an email address', () => {
    expect(el().textContent).toContain('Forgot your password?');
    expect(el().querySelector('#email')).not.toBeNull();
  });

  it('does not send anything for a missing or malformed address', async () => {
    await submitWith('');
    expect(el().textContent).toContain('Enter the email address');
    await submitWith('not-an-email');
    http.expectNone((r) => r.url.endsWith('/users/forgot-password'));
  });

  it('sends the trimmed address and then shows a message that does not reveal whether it is registered', async () => {
    await submitWith('  asha@example.com ');

    const req = http.expectOne((r) => r.url.endsWith('/users/forgot-password'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'asha@example.com' });
    req.flush(null);
    fixture.detectChanges();

    expect(el().textContent).toContain('If an account exists for');
    expect(el().textContent).toContain('asha@example.com');
    expect(el().textContent).toContain('expires in 30 minutes');
    expect(el().querySelector('#email')).toBeNull();
  });

  it('lets the customer go back and use a different address', async () => {
    await submitWith('typo@example.com');
    http.expectOne((r) => r.url.endsWith('/users/forgot-password')).flush(null);
    fixture.detectChanges();

    (Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('different address')) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el().querySelector('#email')).not.toBeNull();
  });

  it('says so, without claiming success, when the request fails', async () => {
    await submitWith('asha@example.com');
    http.expectOne((r) => r.url.endsWith('/users/forgot-password')).flush({}, { status: 500, statusText: 'err' });
    fixture.detectChanges();

    expect(el().textContent).toContain("couldn't send the email");
    expect(el().textContent).not.toContain('If an account exists');
  });

  describe('after the email has been sent', () => {
    beforeEach(async () => {
      await submitWith('asha@example.com');
      http.expectOne((r) => r.url.endsWith('/users/forgot-password')).flush(null);
      fixture.detectChanges();
    });

    const resendButton = () =>
      Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('Resend email')) as HTMLButtonElement;

    it('shows a confirmation with what to do next', () => {
      expect(el().textContent).toContain('Check your inbox');
      expect(el().querySelectorAll('.steps li').length).toBe(3);
      expect(el().textContent).toContain('spam');
    });

    it('makes the customer wait a moment before the email can be requested again', () => {
      expect(resendButton().disabled).toBeTrue();
      expect(resendButton().textContent).toContain('Resend email in 30s');
    });

    it('sends it again to the same address once the wait is over, and says so', () => {
      fixture.componentInstance.cooldown.set(0); // the wait is over
      fixture.detectChanges();
      expect(resendButton().disabled).toBeFalse();

      resendButton().click();
      const req = http.expectOne((r) => r.url.endsWith('/users/forgot-password'));
      expect(req.request.body).toEqual({ email: 'asha@example.com' });
      req.flush(null);
      fixture.detectChanges();

      expect(el().textContent).toContain("We've sent it again");
      expect(resendButton().disabled).toBeTrue(); // waiting again
    });

    it('reports a failed resend without claiming it was sent', () => {
      fixture.componentInstance.cooldown.set(0);
      fixture.detectChanges();
      resendButton().click();
      http.expectOne((r) => r.url.endsWith('/users/forgot-password')).flush({}, { status: 500, statusText: 'err' });
      fixture.detectChanges();

      expect(el().textContent).toContain("couldn't send it again");
      expect(el().textContent).not.toContain("We've sent it again");
    });
  });
});
