import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { OrderService } from '../../service/order/order-service';
import { CartService } from '../../service/cart/CartService';
import { PaymentService } from '../../service/payment/payment-service';
import { ProductService } from '../../service/product/product-service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ORDER_STATUS_LABELS } from '../../model/order.model';
import type { OrderItemDto, OrderResponse } from '../../model';
import type { PaymentMethod, PaymentTransactionDto } from '../../model/payment';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { PLACEHOLDER_IMAGE } from '../../shared/uti/image.util';
import { defaultWeightFor } from '../../shared/uti/weight-pricing.util';

interface PaymentBadge {
  text: string;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
}

/** Only the most recent orders get a payment lookup, to keep this page to a handful of requests. */
const PAYMENT_LOOKUP_LIMIT = 20;

/** Orders in these states haven't left the shop yet, so they can still be cancelled. */
const CANCELLABLE = ['PROCESSING', 'CONFIRMED'];

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.html',
  styleUrls: ['./my-orders.css'],
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, ImgFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrders implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly cart = inject(CartService);
  private readonly paymentService = inject(PaymentService);
  private readonly productService = inject(ProductService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly orders = signal<OrderResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  /** Latest payment attempt per order id (undefined until it has loaded, or if there is none). */
  protected readonly payments = signal<Record<string, PaymentTransactionDto | undefined>>({});
  /** Order ids with an action (pay / cancel / reorder) in flight. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());

  protected readonly skeletons = [0, 1];
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  ngOnInit(): void {
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.orderService.findMine().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
        this.loadPayments(orders);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadPayments(orders: OrderResponse[]): void {
    const targets = orders.slice(0, PAYMENT_LOOKUP_LIMIT);
    if (!targets.length) return;
    forkJoin(
      targets.map((o) =>
        this.paymentService.findByOrder(o.id).pipe(catchError(() => of([] as PaymentTransactionDto[]))),
      ),
    ).subscribe((lists) => {
      const next: Record<string, PaymentTransactionDto | undefined> = { ...this.payments() };
      targets.forEach((o, i) => (next[o.id] = lists[i][0])); // newest first
      this.payments.set(next);
    });
  }

  private refreshPayment(orderId: string): void {
    this.paymentService.findByOrder(orderId).subscribe({
      next: (list) => this.payments.update((current) => ({ ...current, [orderId]: list[0] })),
    });
  }

  // ----------------------------------------------------------------- display

  protected itemImageUrl(imageId: string | undefined): string {
    return imageId ? this.productService.imageUrl(imageId) : PLACEHOLDER_IMAGE;
  }

  protected isBusy(order: OrderResponse): boolean {
    return this.busy().has(order.id);
  }

  protected paymentBadge(order: OrderResponse): PaymentBadge | null {
    const tx = this.payments()[order.id];
    if (order.status === 'CANCELLED') {
      // A cancelled order is refunded automatically; say where that stands. "Refund pending" means the
      // automatic refund didn't go through and the shop has to issue it by hand.
      if (tx?.status === 'REFUNDED') return { text: 'Refunded', tone: 'neutral' };
      if (tx?.status === 'SUCCESS' && tx.method !== 'COD') return { text: 'Refund pending', tone: 'warn' };
      return null;
    }
    if (!tx) return null;
    switch (tx.status) {
      case 'SUCCESS':
        if (tx.method !== 'COD' && (tx.refundedAmount ?? 0) > 0) {
          return { text: `Partly refunded (₹${tx.refundedAmount} of ₹${tx.amount})`, tone: 'neutral' };
        }
        return { text: tx.method === 'COD' ? 'Cash collected' : `Paid online (${tx.method})`, tone: 'ok' };
      case 'REFUNDED':
        return { text: 'Refunded', tone: 'neutral' };
      case 'FAILED':
        return { text: 'Payment failed', tone: 'bad' };
      default:
        return tx.method === 'COD'
          ? { text: 'Pay cash on delivery', tone: 'neutral' }
          : { text: 'Payment pending', tone: 'warn' };
    }
  }

  protected hasPaidOnline(order: OrderResponse): boolean {
    const tx = this.payments()[order.id];
    return !!tx && tx.status === 'SUCCESS' && tx.method !== 'COD';
  }

  /** An online payment that never completed - the customer can finish paying or switch to cash. */
  protected canPay(order: OrderResponse): boolean {
    const tx = this.payments()[order.id];
    return (
      order.status !== 'CANCELLED' &&
      !!tx &&
      tx.method !== 'COD' &&
      (tx.status === 'PENDING' || tx.status === 'FAILED' || tx.status === 'CREATED')
    );
  }

  /** Until it ships an order can be cancelled; one paid online is refunded automatically. */
  protected canCancel(order: OrderResponse): boolean {
    return CANCELLABLE.includes(order.status);
  }

  // ----------------------------------------------------------------- actions

  protected async payNow(order: OrderResponse): Promise<void> {
    const tx = this.payments()[order.id];
    if (!tx || this.isBusy(order)) return;
    this.setBusy(order, true);
    try {
      await this.paymentService.payForOrder(order.id, order.totalAmount, tx.method as PaymentMethod, {
        customerName: order.username,
      });
      this.toast.success('Payment successful! Your order is confirmed.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'cancelled';
      this.toast.error(`The payment didn't go through (${reason}).`);
    } finally {
      this.refreshPayment(order.id);
      this.setBusy(order, false);
    }
  }

  protected async payOnDelivery(order: OrderResponse): Promise<void> {
    if (this.isBusy(order)) return;
    this.setBusy(order, true);
    try {
      await this.paymentService.payForOrder(order.id, order.totalAmount, 'COD');
      this.toast.success("Done - you'll pay in cash when your order arrives.");
    } catch {
      this.toast.error("We couldn't switch this order to cash on delivery. Please try again.");
    } finally {
      this.refreshPayment(order.id);
      this.setBusy(order, false);
    }
  }

  protected async cancel(order: OrderResponse): Promise<void> {
    if (this.isBusy(order)) return;
    const ok = await this.confirm.confirm({
      title: `Cancel order #${order.id.slice(0, 8)}?`,
      message: this.hasPaidOnline(order)
        ? `The items go back on the shelf and your online payment of ₹${order.totalAmount} will be refunded to your original payment method. This cannot be undone.`
        : 'The items go back on the shelf and this cannot be undone.',
      confirmText: 'Cancel order',
      cancelText: 'Keep order',
      tone: 'danger',
    });
    if (!ok) return;

    this.setBusy(order, true);
    this.orderService.cancel(order.id).subscribe({
      next: (updated) => {
        this.orders.update((list) =>
          list.map((o) => (o.id === order.id ? { ...o, ...updated, orderDateTime: o.orderDateTime } : o)),
        );
        this.toast.success(
          this.hasPaidOnline(order)
            ? 'Your order has been cancelled and your payment is being refunded.'
            : 'Your order has been cancelled.',
        );
        this.refreshPayment(order.id); // pick up the refund
        this.setBusy(order, false);
      },
      error: () => this.setBusy(order, false),
    });
  }

  /** Puts the order's items back in the cart (same pack sizes) and opens it. */
  protected reorder(order: OrderResponse): void {
    if (this.isBusy(order)) return;
    this.setBusy(order, true);

    forkJoin(
      order.items.map((item) =>
        this.cart
          .addItemToCart(item.productId, item.weight ?? defaultWeightFor(null), Math.max(1, Math.round(item.quantity)))
          .pipe(catchError(() => of(null))),
      ),
    ).subscribe((results) => {
      const added = results.filter((r) => r !== null).length;
      const skipped = results.length - added;
      this.cart.syncCartFromBackend();
      this.setBusy(order, false);

      if (added === 0) {
        this.toast.error("None of these items are available right now.");
        return;
      }
      this.toast.success(
        skipped
          ? `${added} item${added === 1 ? '' : 's'} added to your cart. ${skipped} couldn't be added (out of stock or no longer sold).`
          : 'Items added to your cart.',
      );
      this.router.navigate(['/cart']);
    });
  }

  protected itemWeightText(item: OrderItemDto): string {
    return item.weight ? `${item.quantity} × ${item.weight}` : `${item.quantity} qty`;
  }

  private setBusy(order: OrderResponse, on: boolean): void {
    this.busy.update((current) => {
      const next = new Set(current);
      if (on) next.add(order.id);
      else next.delete(order.id);
      return next;
    });
  }
}
