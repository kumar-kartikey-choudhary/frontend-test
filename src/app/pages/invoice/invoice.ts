import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, forkJoin, of, switchMap, tap } from 'rxjs';
import { OrderService } from '../../service/order/order-service';
import { PaymentService } from '../../service/payment/payment-service';
import type { OrderResponse } from '../../model';
import type { PaymentTransactionDto } from '../../model/payment';
import { StorageService } from '../../core/services/storage.service';
import { environment } from '../../../environments/environment';

/** A printable invoice / receipt for one order (the browser's Print dialog can save it as a PDF). */
@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice.html',
  styleUrl: './invoice.css',
})
export class Invoice {
  /** From the `:id` route parameter (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly orders = inject(OrderService);
  private readonly payments = inject(PaymentService);
  private readonly storage = inject(StorageService);

  protected readonly shop = environment.shop;
  protected readonly phone = environment.supportPhone;

  protected readonly order = signal<OrderResponse | null>(null);
  protected readonly payment = signal<PaymentTransactionDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal<'missing' | 'error' | null>(null);

  protected readonly invoiceNumber = computed(() => (this.order()?.id ?? '').slice(0, 8).toUpperCase());
  protected readonly cancelled = computed(() => this.order()?.status === 'CANCELLED');
  protected readonly paymentText = computed(() => {
    const p = this.payment();
    if (!p) return 'Not yet paid';
    if (p.status === 'REFUNDED') return `${this.methodLabel(p)} - refunded`;
    if (p.status === 'SUCCESS') {
      const partly = p.refundedAmount && p.refundedAmount > 0 ? ` (₹${p.refundedAmount} refunded)` : '';
      return p.method === 'COD' ? 'Paid in cash on delivery' : `Paid online - ${this.methodLabel(p)}${partly}`;
    }
    if (p.method === 'COD') return 'Cash on delivery - to be paid when delivered';
    return 'Payment not completed';
  });

  constructor() {
    toObservable(this.id)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failed.set(null);
        }),
        switchMap((id) =>
          forkJoin({
            order: this.orders.findDetail(id),
            // The invoice is still useful if the payment lookup fails, so that failure is not an error here.
            payments: this.payments.findByOrder(id).pipe(catchError(() => of([] as PaymentTransactionDto[]))),
          }).pipe(
            catchError((err) => {
              this.failed.set(err?.status === 404 || err?.status === 403 ? 'missing' : 'error');
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ order, payments }) => {
        this.order.set(order);
        // The payment that counts: a successful (or refunded) one, otherwise the most recent attempt.
        this.payment.set(payments.find((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED') ?? payments[0] ?? null);
        this.loading.set(false);
      });
  }

  private methodLabel(p: PaymentTransactionDto): string {
    return p.method === 'COD' ? 'Cash on delivery' : p.method.charAt(0) + p.method.slice(1).toLowerCase();
  }

  protected print(): void {
    if (this.storage.isBrowser) window.print();
  }
}
