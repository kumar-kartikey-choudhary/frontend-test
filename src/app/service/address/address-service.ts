import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AddressDto } from '../../model/address.model';

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly apiUrl = `${environment.apiBaseUrl}/users/addresses`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<AddressDto[]> {
    return this.http.get<AddressDto[]>(this.apiUrl);
  }

  get(id: string): Observable<AddressDto> {
    return this.http.get<AddressDto>(`${this.apiUrl}/${id}`);
  }

  create(address: Partial<AddressDto>): Observable<AddressDto> {
    return this.http.post<AddressDto>(this.apiUrl, address);
  }

  update(id: string, address: Partial<AddressDto>): Observable<AddressDto> {
    return this.http.patch<AddressDto>(`${this.apiUrl}/${id}`, address);
  }

  markDefault(id: string): Observable<AddressDto> {
    return this.http.patch<AddressDto>(`${this.apiUrl}/${id}/default`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}