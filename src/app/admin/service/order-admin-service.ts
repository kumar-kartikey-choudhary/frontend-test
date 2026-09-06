import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  OrderResponse,
  OrderStatus,
  OrderItemDto,
  PaymentDto,
  PaymentMethod,
  PaymentStatus,
} from '../../model';

export type { OrderResponse, OrderStatus, OrderItemDto, PaymentDto, PaymentMethod, PaymentStatus };

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

  /** Admin: manual payment entry - COD reconciliation or recording a gateway callback.
   *  Every call appends a Payment row rather than overwriting, so retries/refunds stay visible. */
  recordPayment(
    orderId: string,
    method: PaymentMethod,
    amount: number,
    status: PaymentStatus,
    transactionId?: string,
  ): Observable<PaymentDto> {
    const params: Record<string, string> = { method, amount: String(amount), status };
    if (transactionId) {
      params['transactionId'] = transactionId;
    }
    return this.http.post<PaymentDto>(`${this.API_URL}/admin/${orderId}/payments`, null, { params });
  }
}