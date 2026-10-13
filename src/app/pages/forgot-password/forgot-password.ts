import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../service/login/auth-service';

/**
 * Step 1 of resetting a password: ask for the account's email address. The server always answers the
 * same way, so this page never says whether an account exists for the address - it can't be used to
 * find out who is registered.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.html',
  styleUrls: ['../login/login.css', './forgot-password.css'],
  imports: [RouterLink, FormsModule],
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Seconds the customer has to wait before the email can be requested again. */
  static readonly RESEND_WAIT_SECONDS = 30;
  /** Shown in the confirmation; keep in step with app.password-reset.expiry-minutes on the server. */
  readonly linkMinutes = 30;

  email = '';
  readonly submitting = signal(false);
  readonly sentTo = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly cooldown = signal(0);
  readonly resending = signal(false);
  /** The email was sent a second (or later) time - lets the page say so. */
  readonly resent = signal(false);
  readonly resendError = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  onSubmit(): void {
    const email = this.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      this.errorMessage.set('Enter the email address you signed up with.');
      return;
    }
    if (this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.authService.requestPasswordReset(email).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sentTo.set(email);
        this.resent.set(false);
        this.startCooldown();
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set("We couldn't send the email right now. Please try again in a moment.");
      },
    });
  }

  /** Send the same email again, once the wait is over. */
  resend(): void {
    const email = this.sentTo();
    if (!email || this.cooldown() > 0 || this.resending()) return;

    this.resending.set(true);
    this.resendError.set(null);
    this.authService.requestPasswordReset(email).subscribe({
      next: () => {
        this.resending.set(false);
        this.resent.set(true);
        this.startCooldown();
      },
      error: () => {
        this.resending.set(false);
        this.resendError.set("We couldn't send it again right now. Please try again in a moment.");
      },
    });
  }

  /** Back to the form, e.g. after a typo or a message that never arrived. */
  tryAgain(): void {
    this.stopTimer();
    this.sentTo.set(null);
    this.errorMessage.set(null);
    this.resendError.set(null);
    this.resent.set(false);
  }

  private startCooldown(): void {
    this.stopTimer();
    this.cooldown.set(ForgotPassword.RESEND_WAIT_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update((seconds) => Math.max(0, seconds - 1));
      if (this.cooldown() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.cooldown.set(0);
  }
}
