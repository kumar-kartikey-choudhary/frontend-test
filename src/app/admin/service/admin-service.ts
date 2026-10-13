import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { UserDto } from '../../model';

export type { UserDto };

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private apiUrl = `${environment.apiBaseUrl}/users/admin/findAll`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.apiUrl);
  }

  /** Deletes a customer's account: personal data is erased and they can no longer sign in. Their orders stay on record. */
  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/users/delete/${id}`);
  }
}