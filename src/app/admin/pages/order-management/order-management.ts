import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Pager } from '../../../shared/components/pager/pager';
import { Paginator } from '../../../shared/uti/paginator';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OrderAdminService, OrderResponse, OrderStatus } from '../../service/order-admin-service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ORDER_STATUS_LABELS } from '../../../model/order.model';

@Component({
  selector: 'app-order-management',
  templateUrl: './order-management.html',
  styleUrls: ['./order-management.css'],
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderManagement implements OnInit {
  private readonly orderAdminService = inject(OrderAdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);

  private readonly allOrders = signal<OrderResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMsg = signal('');

  protected readonly selectedStatus = signal('All');
  protected readonly searchTerm = signal('');
  /** Paging over the filtered list. */
  protected readonly pg = new Paginator(() => this.filteredOrders());

  /** Orders whose detail row is open. */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly updating = signal<ReadonlySet<string>>(new Set());

  protected readonly statusOptions = ['All', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  protected readonly assignableStatuses: OrderStatus[] = ['PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  protected readonly statusLabels: Record<string, string> = ORDER_STATUS_LABELS;

  /** Badge colour for an order status. */
  protected badgeFor(status: string): string {
    switch (status) {
      case 'DELIVERED':
        return 'adm-badge--success';
      case 'CANCELLED':
        return 'adm-badge--danger';
      case 'SHIPPED':
        return 'adm-badge--info';
      case 'CONFIRMED':
        return 'adm-badge--brand';
      default:
        return 'adm-badge--warning';
    }
  }

  protected readonly filteredOrders = computed(() => {
    let orders = this.allOrders();
    if (this.selectedStatus() !== 'All') {
      orders = orders.filter((order) => order.status === this.selectedStatus());
    }
    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      orders = orders.filter(
        (order) => order.username.toLowerCase().includes(term) || order.id.toLowerCase().includes(term),
      );
    }
    // Newest first
    return [...orders].sort(
      (a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime(),
    );
  });

  ngOnInit(): void {
    // The Users page links here with ?q=<username> to show one customer's orders.
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.searchTerm.set(q);
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.orderAdminService.getAllOrders().subscribe({
      next: (orders) => {
        this.allOrders.set(orders);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Could not load orders.');
        this.isLoading.set(false);
      },
    });
  }

  protected isExpanded(order: OrderResponse): boolean {
    return this.expanded().has(order.id);
  }

  protected toggleDetails(order: OrderResponse): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(order.id)) next.delete(order.id);
      else next.add(order.id);
      return next;
    });
  }

  /** Delivered and cancelled orders are final: the server refuses any further status change. */
  protected isFinal(order: OrderResponse): boolean {
    return order.status === 'DELIVERED' || order.status === 'CANCELLED';
  }

  protected isUpdating(order: OrderResponse): boolean {
    return this.updating().has(order.id);
  }

  protected async changeStatus(order: OrderResponse, select: HTMLSelectElement): Promise<void> {
    const status = select.value as OrderStatus;
    if (status === order.status) return;

    if (status === 'CANCELLED') {
      const ok = await this.confirm.confirm({
        title: `Cancel order #${order.id.slice(0, 8)}?`,
        message: 'The reserved stock goes back on the shelf, and if the customer paid online the payment is refunded to them automatically.',
        confirmText: 'Cancel order',
        cancelText: 'Keep order',
        tone: 'danger',
      });
      if (!ok) {
        select.value = order.status;
        return;
      }
    }

    // Optional note, recorded next to the transition in the order's history.
    const remarks = await this.confirm.prompt({
      title: `Move to "${this.statusLabels[status]}"`,
      confirmText: 'Update status',
      input: { label: 'Note for the history (optional)', placeholder: 'e.g. customer asked to reschedule' },
    });
    if (remarks === null) {
      select.value = order.status; // dialog dismissed: undo the visual change
      return;
    }

    this.updating.update((s) => new Set(s).add(order.id));
    this.orderAdminService.updateStatus(order.id, status, remarks || undefined).subscribe({
      next: (updated) => {
        this.allOrders.update((list) =>
          list.map((o) =>
            o.id === order.id
              ? { ...o, status: updated.status, statusHistory: updated.statusHistory?.length ? updated.statusHistory : o.statusHistory }
              : o,
          ),
        );
        this.toast.success(`Order #${order.id.slice(0, 8)} is now ${this.statusLabels[updated.status]}.`);
        this.finishUpdate(order);
      },
      error: () => {
        select.value = order.status;
        this.finishUpdate(order);
      },
    });
  }

  private finishUpdate(order: OrderResponse): void {
    this.updating.update((s) => {
      const next = new Set(s);
      next.delete(order.id);
      return next;
    });
    // Status history is only returned by the list endpoint, so refresh to show the new entry.
    this.loadHistoryQuietly();
  }

  private loadHistoryQuietly(): void {
    this.orderAdminService.getAllOrders().subscribe({ next: (orders) => this.allOrders.set(orders) });
  }
}
