import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { NotificationDto } from '../../model/notification';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = `${environment.apiBaseUrl}/users/notifications`;

  // Simple unread-count state so a navbar bell badge can subscribe without every
  // component re-fetching the full list - call refreshUnreadCount() after login /
  // periodically if a live badge is wanted later.
  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  getAll(): Observable<NotificationDto[]> {
    return this.http.get<NotificationDto[]>(this.apiUrl).pipe(
      tap((notifications) => {
        this.unreadCountSubject.next(notifications.filter((n) => !n.read).length);
      }),
    );
  }

  markRead(id: string): Observable<NotificationDto> {
    return this.http.patch<NotificationDto>(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1))),
    );
  }

  markAllRead(): Observable<void> {
    return this.http
      .patch<void>(`${this.apiUrl}/read-all`, {})
      .pipe(tap(() => this.unreadCountSubject.next(0)));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  refreshUnreadCount(): void {
    this.getAll().subscribe({ error: () => {} });
  }
}