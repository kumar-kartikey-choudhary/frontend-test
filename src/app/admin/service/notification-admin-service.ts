import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AdminNotificationRequest } from '../../model';

@Injectable({ providedIn: 'root' })
export class NotificationAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/users/notifications`;

  /** Sends a notification to one customer or to every customer; resolves with how many were sent. */
  send(request: AdminNotificationRequest): Observable<{ sent: number }> {
    return this.http.post<{ sent: number }>(`${this.apiUrl}/admin/send`, request);
  }
}
