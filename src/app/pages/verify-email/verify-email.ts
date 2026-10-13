import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../service/login/auth-service';
import { UserService } from '../../service/user/user-service';
import { ToastService } from '../../core/services/toast.service';

/** The page the "confirm your email" link opens. */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  templateUrl: './verify-email.html',
  styleUrls: ['../login/login.css'],
  imports: [RouterLink],
})
export class VerifyEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly state = signal<'checking' | 'verified' | 'failed'>('checking');
  protected readonly message = signal('');
  protected readonly resending = signal(false);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('failed');
      this.message.set('This verification link is incomplete. Please request a new one.');
      return;
    }
    // Take the token out of the address bar and history now that we hold it.
    this.router.navigate([], { relativeTo: this.route, queryParams: { token: null }, replaceUrl: true });

    this.userService.verifyEmail(token).subscribe({
      next: () => this.state.set('verified'),
      error: (error) => {
        this.state.set('failed');
        this.message.set(error?.error?.message || "We couldn't verify your email address. Please try again.");
      },
    });
  }

  protected resend(): void {
    if (this.resending()) return;
    this.resending.set(true);
    this.userService.resendVerification().subscribe({
      next: () => {
        this.toast.success('We sent you a new verification email.');
        this.resending.set(false);
      },
      error: () => this.resending.set(false),
    });
  }
}
