import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../service/login/auth-service';
import { ToastService } from '../../core/services/toast.service';

/** Step 2: the page the emailed link opens. The token in the link proves the person owns the mailbox. */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  templateUrl: './reset-password.html',
  styleUrls: ['../login/login.css', './reset-password.css'],
  imports: [RouterLink, FormsModule],
})
export class ResetPassword implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly MIN_PASSWORD_LENGTH = 8;

  form = { password: '', confirm: '' };
  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  /** True when the link has no token, or the server says it is used up or expired. */
  readonly linkProblem = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  private token: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.linkProblem.set('This reset link is incomplete. Please request a new one.');
      return;
    }
    // Take the token out of the address bar (and browser history) now that we hold it, so it isn't
    // left lying around for the next page, a screenshot, or a Referer header.
    this.router.navigate([], { relativeTo: this.route, queryParams: { token: null }, replaceUrl: true });
  }

  /** A rough guide for the customer - length plus mix of character types. The server only enforces length. */
  get strength(): { level: 'weak' | 'fair' | 'strong'; label: string } {
    const pw = this.form.password;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
    if (pw.length >= 12 && classes >= 3) return { level: 'strong', label: 'Strong password' };
    if (pw.length >= 8 && classes >= 2) return { level: 'fair', label: 'Fair - add more variety to strengthen it' };
    return { level: 'weak', label: 'Weak - use 8+ characters with a mix of letters and numbers' };
  }

  /** The little checklist under the password box. */
  get rules(): { text: string; met: boolean }[] {
    const pw = this.form.password;
    return [
      { text: `At least ${this.MIN_PASSWORD_LENGTH} characters`, met: pw.length >= this.MIN_PASSWORD_LENGTH },
      { text: 'Letters and numbers (or symbols)', met: /[A-Za-z]/.test(pw) && /[^A-Za-z]/.test(pw) },
      { text: 'Both boxes match', met: !!pw && pw === this.form.confirm },
    ];
  }

  get tooShort(): boolean {
    return !!this.form.password && this.form.password.length < this.MIN_PASSWORD_LENGTH;
  }

  get mismatch(): boolean {
    return !!this.form.confirm && this.form.password !== this.form.confirm;
  }

  onSubmit(): void {
    if (!this.token || this.submitting()) return;
    if (!this.form.password || this.tooShort || this.mismatch || !this.form.confirm) {
      this.errorMessage.set(
        this.mismatch || !this.form.confirm
          ? "The two passwords don't match."
          : `Use at least ${this.MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.authService.resetPassword(this.token, this.form.password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Password changed. You can sign in now.');
        this.router.navigate(['/login'], { queryParams: { passwordReset: true } });
      },
      error: (error) => {
        this.submitting.set(false);
        if (error?.status === 400 && /link|expired/i.test(error?.error?.message ?? '')) {
          this.linkProblem.set(error.error.message);
        } else {
          this.errorMessage.set(error?.error?.message || "We couldn't change your password. Please try again.");
        }
      },
    });
  }
}
