import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserDto } from '../../model';

/** Calls on the signed-in customer's own profile. (Admin user listing lives in AdminService.) */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/users`;

  me(): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.apiUrl}/me`);
  }

  /** Confirms the email address using the token from the emailed link. Public. */
  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/verify-email`, { token });
  }

  /** Sends the signed-in customer a fresh verification email (at most one a minute). */
  resendVerification(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/resend-verification`, {});
  }

  /** Updates profile fields. (The username can't be changed - the backend ignores it.) */
  update(id: string, changes: Partial<UserDto>): Observable<UserDto> {
    return this.http.patch<UserDto>(`${this.apiUrl}/update/${id}`, changes);
  }
}
