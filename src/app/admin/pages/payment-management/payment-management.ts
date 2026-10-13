import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Pager } from '../../../shared/components/pager/pager';
import { Paginator } from '../../../shared/uti/paginator';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PaymentAdminService } from '../../service/payment-admin-service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import type { PaymentTransactionDto } from '../../../model/payment';

@Component({
  selector: 'app-payment-management',
  templateUrl: './payment-management.html',
  styleUrls: ['./payment-management.css'],
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentManagement implements OnInit {
  protected readonly allPayments = signal<PaymentTransactionDto[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly errorMsg = signal('');

  protected readonly selectedStatus = signal('All');
  protected readonly searchTerm = signal('');
  /** Paging over the filtered list. */
  protected readonly pg = new Paginator(() => this.filteredPayments());


  statusOptions = ['All', 'CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

  /** Badge colour for a payment status. */
  badgeFor(status: string): string {
    switch (status) {
      case 'SUCCESS':
        return 'adm-badge--success';
      case 'FAILED':
        return 'adm-badge--danger';
      case 'PENDING':
        return 'adm-badge--warning';
      case 'CREATED':
        return 'adm-badge--info';
      default:
        return ''; // REFUNDED and anything unknown: neutral
    }
  }

  private readonly paymentAdminService = inject(PaymentAdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.paymentAdminService.getAllPayments().subscribe({
      next: (payments) => {
        this.allPayments.set(payments);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Could not load payments.');
        this.isLoading.set(false);
      },
    });
  }

  readonly totalCollected = computed(() =>
    this.allPayments()
      .filter((p) => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + Number(p.amount), 0),
  );

  private readonly pendingCod = computed(() =>
    this.allPayments().filter((p) => p.method === 'COD' && p.status === 'PENDING'),
  );
  readonly pendingCodCount = computed(() => this.pendingCod().length);
  readonly pendingCodAmount = computed(() => this.pendingCod().reduce((sum, p) => sum + Number(p.amount), 0));
  readonly failedCount = computed(() => this.allPayments().filter((p) => p.status === 'FAILED').length);

  readonly filteredPayments = computed(() => {
    let payments = this.allPayments();
    if (this.selectedStatus() !== 'All') {
      payments = payments.filter((p) => p.status === this.selectedStatus());
    }
    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      payments = payments.filter(
        (p) =>
          p.orderId.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.gatewayPaymentId || '').toLowerCase().includes(term),
      );
    }
    return [...payments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  /** Only money that actually went through the payment gateway can be sent back through it. */
  protected canRefund(payment: PaymentTransactionDto): boolean {
    return payment.status === 'SUCCESS' && payment.method !== 'COD';
  }

  protected canCollect(payment: PaymentTransactionDto): boolean {
    return payment.method === 'COD' && payment.status === 'PENDING';
  }

  /** How much of a payment can still be sent back. */
  protected remaining(payment: PaymentTransactionDto): number {
    return Math.max(0, +(payment.amount - (payment.refundedAmount ?? 0)).toFixed(2));
  }

  async refund(payment: PaymentTransactionDto): Promise<void> {
    if (!this.canRefund(payment)) {
      this.toast.error('Only a successful online payment can be refunded.');
      return;
    }
    const remaining = this.remaining(payment);
    // One dialog does both jobs: confirm the refund and say how much. Empty means everything that is left.
    const answer = await this.confirm.prompt({
      title: `Refund order #${payment.orderId.slice(0, 8)}?`,
      message:
        `₹${remaining} of this ₹${payment.amount} payment can still be returned to the customer through the payment gateway. ` +
        'Leave the amount empty to refund all of it, or type a smaller amount for a partial refund. This cannot be undone.',
      confirmText: 'Refund',
      tone: 'danger',
      input: { label: 'Amount to refund (₹)', placeholder: `${remaining} (everything left)` },
    });
    if (answer === null) return;

    let amount: number | undefined;
    if (answer.trim() !== '') {
      amount = Number(answer.trim());
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
        this.toast.error(`Enter an amount between ₹0.01 and ₹${remaining}, or leave it empty to refund everything.`);
        return;
      }
    }

    this.paymentAdminService.refund(payment.id, amount).subscribe({
      next: (updated) => {
        this.allPayments.update((list) =>
          list.map((p) =>
            p.id === payment.id ? { ...p, status: updated.status, refundedAmount: updated.refundedAmount } : p,
          ),
        );
        this.toast.success(updated.status === 'REFUNDED' ? 'Refund issued.' : `Refunded ₹${amount}. ₹${this.remaining(updated)} can still be refunded.`);
      },
      // The server's message (e.g. a gateway failure) is shown by the error interceptor.
    });
  }

  /** COD orders sit as PENDING forever unless an admin confirms cash was collected. */
  async markCollected(payment: PaymentTransactionDto): Promise<void> {
    if (payment.method !== 'COD' || payment.status !== 'PENDING') return;
    const ok = await this.confirm.confirm({
      title: 'Mark cash as collected?',
      message: `COD order #${payment.orderId.slice(0, 8)} - ₹${payment.amount}.`,
      confirmText: 'Mark collected',
    });
    if (!ok) return;

    this.paymentAdminService.markCodCollected(payment.id).subscribe({
      next: (updated) => {
        this.allPayments.update((list) =>
          list.map((p) => (p.id === payment.id ? { ...p, status: updated.status, paidAt: updated.paidAt } : p)),
        );
        this.toast.success('Cash payment recorded.');
      },
    });
  }
}
