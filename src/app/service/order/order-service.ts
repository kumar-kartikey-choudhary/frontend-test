import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { OrderResponse } from '../../model';

/** Customer-facing order calls (the admin equivalents live in OrderAdminService). */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/orders`;

  /** The signed-in customer's orders, newest first. */
  findMine(): Observable<OrderResponse[]> {
    return this.http
      .get<OrderResponse[]>(`${this.apiUrl}/findByCustomer`)
      .pipe(
        map((orders) =>
          [...orders].sort(
            (a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime(),
          ),
        ),
      );
  }

  /** One order with product names and the status history - what the invoice page shows. */
  findDetail(orderId: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.apiUrl}/${orderId}/detail`);
  }

  /** Cancels one of the customer's own orders (only before it ships); releases the reserved stock. */
  cancel(orderId: string): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.apiUrl}/${orderId}/cancel`, {});
  }
}
