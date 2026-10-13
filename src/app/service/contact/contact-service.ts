import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ContactMessageDto, ContactRequest } from '../../model';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/users`;

  /** The website's contact form. Public. */
  send(request: ContactRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/contact`, request);
  }

  // ---------- Admin ----------

  findAll(): Observable<ContactMessageDto[]> {
    return this.http.get<ContactMessageDto[]>(`${this.apiUrl}/admin/contact`);
  }

  markHandled(id: string, handled: boolean): Observable<ContactMessageDto> {
    return this.http.patch<ContactMessageDto>(`${this.apiUrl}/admin/contact/${id}/handled`, {}, { params: { handled } });
  }
}
