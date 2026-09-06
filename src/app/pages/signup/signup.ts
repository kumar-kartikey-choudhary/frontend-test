import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, RouterLink, FormsModule],
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
        this.toast.success('Account created! Please sign in.');
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