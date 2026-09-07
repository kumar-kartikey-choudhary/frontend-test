import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PaymentTransactionDto } from '../../model/payment';

@Injectable({ providedIn: 'root' })
export class PaymentAdminService {
  private readonly apiUrl = `${environment.apiBaseUrl}/payments`;

  constructor(private http: HttpClient) {}

  /** Admin: fetch every payment transaction across all customers. */
  getAllPayments(): Observable<PaymentTransactionDto[]> {
    return this.http.get<PaymentTransactionDto[]>(`${this.apiUrl}/admin/all`);
  }

  /** Admin: refund a successful payment. amount omitted = full refund. */
  refund(paymentId: string, amount?: number, reason?: string): Observable<PaymentTransactionDto> {
    return this.http.post<PaymentTransactionDto>(`${this.apiUrl}/admin/${paymentId}/refund`, {
      amount,
      reason,
    });
  }

  /** Admin: confirm a COD transaction's cash was collected at delivery. */
  markCodCollected(paymentId: string): Observable<PaymentTransactionDto> {
    return this.http.post<PaymentTransactionDto>(`${this.apiUrl}/admin/${paymentId}/collect`, {});
  }
}