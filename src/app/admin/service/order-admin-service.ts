import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  OrderResponse,
  OrderStatus,
  OrderItemDto,
} from '../../model';

export type { OrderResponse, OrderStatus, OrderItemDto };

@Injectable({
  providedIn: 'root',
})
export class OrderAdminService {
  private readonly API_URL = `${environment.apiBaseUrl}/orders`;

  constructor(private http: HttpClient) {}

  /** Admin: fetch every order across all customers. */
  getAllOrders(): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(`${this.API_URL}/admin/findAll`);
  }

  /** Admin: change an order's status. remarks is optional - records *why* alongside the
   *  transition in ORDER_STATUS_HISTORY (e.g. "customer requested reschedule"). */
  updateStatus(orderId: string, status: OrderStatus, remarks?: string): Observable<OrderResponse> {
    const params: Record<string, string> = { status };
    if (remarks) {
      params['remarks'] = remarks;
    }
    return this.http.put<OrderResponse>(`${this.API_URL}/admin/updateStatus/${orderId}`, {}, { params });
  }

  /** Admin: delete an order. */
  deleteOrder(orderId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/admin/delete/${orderId}`);
  }
}
