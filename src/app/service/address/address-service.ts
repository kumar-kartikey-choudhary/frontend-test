import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AddressDto } from '../../model/address.model';

/**
 * The backend AddressDto has a Lombok `boolean isDefault`, which Jackson serialises as `"default"`
 * (not `"isDefault"`). The rest of the app uses `isDefault`, so it is translated at this boundary
 * - previously the "Default" badge never showed because the field name didn't match.
 */
type ApiAddress = Omit<AddressDto, 'isDefault'> & { default?: boolean; isDefault?: boolean };

function fromApi(address: ApiAddress): AddressDto {
  const { default: backendDefault, ...rest } = address;
  return { ...rest, isDefault: address.isDefault ?? backendDefault ?? false };
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly apiUrl = `${environment.apiBaseUrl}/users/addresses`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<AddressDto[]> {
    return this.http.get<ApiAddress[]>(this.apiUrl).pipe(map((list) => list.map(fromApi)));
  }

  get(id: string): Observable<AddressDto> {
    return this.http.get<ApiAddress>(`${this.apiUrl}/${id}`).pipe(map(fromApi));
  }

  create(address: Partial<AddressDto>): Observable<AddressDto> {
    const { isDefault, ...rest } = address;
    return this.http
      .post<ApiAddress>(this.apiUrl, { ...rest, default: !!isDefault })
      .pipe(map(fromApi));
  }

  /** The default flag is ignored by the backend here - use markDefault() to change it. */
  update(id: string, address: Partial<AddressDto>): Observable<AddressDto> {
    const { isDefault, ...rest } = address;
    return this.http.patch<ApiAddress>(`${this.apiUrl}/${id}`, rest).pipe(map(fromApi));
  }

  markDefault(id: string): Observable<AddressDto> {
    return this.http.patch<ApiAddress>(`${this.apiUrl}/${id}/default`, {}).pipe(map(fromApi));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
