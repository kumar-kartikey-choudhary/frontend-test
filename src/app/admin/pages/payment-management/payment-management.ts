import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PaymentAdminService } from '../../service/payment-admin-service';
import type { PaymentTransactionDto } from '../../../model/payment';

@Component({
  selector: 'app-payment-management',
  templateUrl: './payment-management.html',
  styleUrls: ['./payment-management.css'],
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
})
export class PaymentManagement implements OnInit {
  private allPayments: PaymentTransactionDto[] = [];

  isLoading = true;
  errorMsg = '';

  selectedStatus = 'All';
  searchTerm = '';

  statusOptions = ['All', 'CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

  constructor(private paymentAdminService: PaymentAdminService) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.paymentAdminService.getAllPayments().subscribe({
      next: (payments) => {
        this.allPayments = payments;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load payments:', err);
        this.errorMsg = 'Could not load payments. Is the backend running?';
        this.isLoading = false;
      },
    });
  }

  get totalCollected(): number {
    return this.allPayments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }

  get pendingCodCount(): number {
    return this.allPayments.filter((p) => p.method === 'COD' && p.status === 'PENDING').length;
  }

  get pendingCodAmount(): number {
    return this.allPayments
      .filter((p) => p.method === 'COD' && p.status === 'PENDING')
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }

  get failedCount(): number {
    return this.allPayments.filter((p) => p.status === 'FAILED').length;
  }

  get filteredPayments(): PaymentTransactionDto[] {
    let payments = this.allPayments;

    if (this.selectedStatus !== 'All') {
      payments = payments.filter((p) => p.status === this.selectedStatus);
    }
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      payments = payments.filter(
        (p) =>
          p.orderId.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.gatewayPaymentId || '').toLowerCase().includes(term),
      );
    }

    return [...payments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  refund(payment: PaymentTransactionDto): void {
    if (payment.status !== 'SUCCESS') {
      alert('Only a successful payment can be refunded.');
      return;
    }
    const reason = window.prompt('Reason for refund (optional):') || undefined;
    if (!window.confirm(`Refund ₹${payment.amount} for order #${payment.orderId}?`)) return;

    this.paymentAdminService.refund(payment.id, undefined, reason).subscribe({
      next: (updated) => {
        const idx = this.allPayments.findIndex((p) => p.id === payment.id);
        if (idx !== -1) {
          this.allPayments[idx] = { ...this.allPayments[idx], status: updated.status };
        }
      },
      error: (err) => {
        console.error('Refund failed:', err);
        alert(err?.error?.message || 'Refund failed. Please try again.');
      },
    });
  }

  /** COD orders sit as PENDING forever unless an admin confirms cash was collected. */
  markCollected(payment: PaymentTransactionDto): void {
    if (payment.method !== 'COD' || payment.status !== 'PENDING') return;
    if (!window.confirm(`Mark COD order #${payment.orderId} (₹${payment.amount}) as collected?`)) return;

    this.paymentAdminService.markCodCollected(payment.id).subscribe({
      next: (updated) => {
        const idx = this.allPayments.findIndex((p) => p.id === payment.id);
        if (idx !== -1) {
          this.allPayments[idx] = { ...this.allPayments[idx], status: updated.status, paidAt: updated.paidAt };
        }
      },
      error: (err) => {
        console.error('Marking COD as collected failed:', err);
        alert(err?.error?.message || 'Could not mark this order as collected. Please try again.');
      },
    });
  }
}