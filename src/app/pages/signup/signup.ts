import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule, NgModel } from '@angular/forms';
import { SignupService } from '../../service/signup/signup-service';
import { ToastService } from '../../core/services/toast.service';
import type { SignUp } from '../../model';

interface SignupForm extends SignUp {
  confirmPassword: string;
}

@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: './signup.html',
  styleUrls: ['./signup.css'],
  imports: [RouterLink, FormsModule],
})
export class Signup {
  private readonly signupService = inject(SignupService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  user: SignupForm = {
    firstName: '',
    middleName: '',
    lastName: '',
    username: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  };

  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  /** Show a field's error only after the user has interacted with it. */
  showError(field: NgModel): boolean {
    return !!field.invalid && (!!field.dirty || !!field.touched);
  }

  /** A rough guide for the user - length plus mix of character types. The server only enforces length. */
  get passwordStrength(): { level: 'weak' | 'fair' | 'strong'; label: string } {
    const pw = this.user.password;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
    if (pw.length >= 12 && classes >= 3) return { level: 'strong', label: 'Strong password' };
    if (pw.length >= 8 && classes >= 2) return { level: 'fair', label: 'Fair - add more variety to strengthen it' };
    return { level: 'weak', label: 'Weak - use 8+ characters with a mix of letters and numbers' };
  }

  get passwordMismatch(): boolean {
    return !!this.user.password && !!this.user.confirmPassword && this.user.password !== this.user.confirmPassword;
  }

  onSubmit(): void {
    if (this.passwordMismatch || this.submitting()) return;

    this.submitting.set(true);
    // confirmPassword is client-side only - the backend's SignUp/UserDto shape has no such field.
    const { confirmPassword, ...payload } = this.user;

    this.signupService.onSignUp(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Account created! We emailed you a link to confirm your address - then sign in.');
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.submitting.set(false);
        const message = error?.error?.message || 'Could not create your account. Please try again.';
        this.toast.error(message);
      },
    });
  }
}