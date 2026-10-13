import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../service/cart/CartService';
import { CouponService } from '../../service/coupon/coupon-service';
import { ProductService } from '../../service/product/product-service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import type { CartItemDto } from '../../model/cart.model';
import type { CouponDto } from '../../model/order.model';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { PLACEHOLDER_IMAGE } from '../../shared/uti/image.util';

/** Keeps the pack sizes of one product together (2 x 250g, 1 x 1kg), in the order the products were first added. */
function groupByProduct(items: CartItemDto[]): CartItemDto[] {
  const order: string[] = [];
  const byProduct = new Map<string, CartItemDto[]>();
  for (const item of items) {
    if (!byProduct.has(item.productId)) {
      byProduct.set(item.productId, []);
      order.push(item.productId);
    }
    byProduct.get(item.productId)!.push(item);
  }
  return order.flatMap((id) => byProduct.get(id)!);
}

@Component({
  selector: 'app-shopping-cart',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, ImgFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shopping-cart.html',
  styleUrls: ['./shopping-cart.css'],
})
export class ShoppingCart implements OnInit {
  private readonly cart = inject(CartService);
  private readonly couponService = inject(CouponService);
  private readonly productService = inject(ProductService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly items = signal<CartItemDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  /** Lines (product + pack size) with a change in flight - their controls are disabled so clicks can't pile up. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());

  protected readonly skeletons = [0, 1, 2];

  // Coupon state - applied client-side as a preview only. The real discount is always
  // recalculated server-side in OrderServiceImpl.create() at checkout. The chosen code is
  // carried forward to the payment page via a query param - see proceedToPayment().
  protected readonly couponInput = signal('');
  protected readonly appliedCoupon = signal<CouponDto | null>(null);
  protected readonly couponError = signal('');
  protected readonly applyingCoupon = signal(false);

  protected readonly totalCount = computed(() =>
    this.items().reduce((sum, item) => sum + (item.quantity || 0), 0),
  );
  protected readonly subtotal = computed(() =>
    this.items().reduce((sum, item) => sum + Number(item.subtotal ?? item.pricePerUnit * item.quantity), 0),
  );
  protected readonly discount = computed(() => {
    const coupon = this.appliedCoupon();
    return coupon ? this.couponService.estimateDiscount(coupon, this.subtotal()) : 0;
  });
  protected readonly total = computed(() => Math.max(0, this.subtotal() - this.discount()));

  /** Why an applied coupon is currently saving nothing, in words the shopper can act on. */
  protected readonly couponHint = computed(() => {
    const coupon = this.appliedCoupon();
    if (!coupon || this.discount() > 0) return '';
    if (coupon.minOrderValue != null && this.subtotal() < coupon.minOrderValue) {
      const missing = coupon.minOrderValue - this.subtotal();
      return `Add ₹${Math.ceil(missing)} more to use this coupon (minimum order ₹${coupon.minOrderValue}).`;
    }
    return "This code doesn't apply to your current cart.";
  });

  ngOnInit(): void {
    this.loadCart();
  }

  protected loadCart(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.cart.getCart().subscribe({
      next: (items) => {
        this.items.set(groupByProduct(items ?? []));
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected imageUrlFor(item: CartItemDto): string {
    return item.productImageId ? this.productService.imageUrl(item.productImageId) : PLACEHOLDER_IMAGE;
  }

  /** A cart line is one product at one pack size, so both identify it. */
  protected lineId(item: CartItemDto): string {
    return `${item.productId}|${item.weight}`;
  }

  protected isBusy(item: CartItemDto): boolean {
    return this.busy().has(this.lineId(item));
  }

  // ------------------------------------------------------------------ coupons

  protected applyCoupon(): void {
    const code = this.couponInput().trim();
    if (!code || this.applyingCoupon()) return;

    this.applyingCoupon.set(true);
    this.couponError.set('');
    this.couponService.find(code).subscribe({
      next: (coupon) => {
        this.appliedCoupon.set(coupon);
        this.applyingCoupon.set(false);
      },
      error: () => {
        this.appliedCoupon.set(null);
        this.couponError.set('Invalid or expired coupon code.');
        this.applyingCoupon.set(false);
      },
    });
  }

  protected removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponInput.set('');
    this.couponError.set('');
  }

  // -------------------------------------------------------------------- lines

  protected increase(item: CartItemDto): void {
    this.setQuantity(item, item.quantity + 1);
  }

  protected decrease(item: CartItemDto): void {
    if (item.quantity <= 1) {
      this.remove(item);
      return;
    }
    this.setQuantity(item, item.quantity - 1);
  }

  private setQuantity(item: CartItemDto, quantity: number): void {
    this.markBusy(item, true);
    this.cart.updateQuantity(item.productId, item.weight, quantity).subscribe({
      next: (updated) => {
        this.replaceItem(item, {
          quantity,
          subtotal: updated?.subtotal ?? item.pricePerUnit * quantity,
        });
        this.cart.setLocalQuantity(item.productId, item.weight, quantity);
        this.markBusy(item, false);
      },
      error: () => this.markBusy(item, false), // e.g. 409 "only 2 kg available" - toasted by the interceptor
    });
  }

  protected readonly clearing = signal(false);

  protected async clearCart(): Promise<void> {
    if (this.clearing() || this.items().length === 0) return;
    const ok = await this.confirm.confirm({
      title: 'Clear your cart?',
      message: `All ${this.totalCount()} ${this.totalCount() === 1 ? 'item' : 'items'} will be removed from your cart.`,
      confirmText: 'Clear cart',
      cancelText: 'Keep items',
      tone: 'danger',
    });
    if (!ok) return;

    this.clearing.set(true);
    this.cart.clearCart().subscribe({
      next: () => {
        this.items.set([]);
        this.appliedCoupon.set(null);
        this.couponInput.set('');
        this.couponError.set('');
        this.toast.success('Your cart is empty.');
        this.clearing.set(false);
      },
      error: () => this.clearing.set(false),
    });
  }

  protected remove(item: CartItemDto): void {
    this.markBusy(item, true);
    this.cart.removeItem(item.productId, item.weight).subscribe({
      next: () => {
        this.items.update((list) => list.filter((i) => this.lineId(i) !== this.lineId(item)));
        this.toast.success(`${item.productName} removed from your cart`);
        this.markBusy(item, false);
      },
      error: () => this.markBusy(item, false),
    });
  }

  private replaceItem(item: CartItemDto, patch: Partial<CartItemDto>): void {
    this.items.update((list) => list.map((i) => (this.lineId(i) === this.lineId(item) ? { ...i, ...patch } : i)));
  }

  private markBusy(item: CartItemDto, on: boolean): void {
    this.busy.update((current) => {
      const next = new Set(current);
      if (on) next.add(this.lineId(item));
      else next.delete(this.lineId(item));
      return next;
    });
  }

  /**
   * The cart doesn't place the order - it hands off to the payment page, where the customer picks
   * a delivery address and payment method. The coupon code (if any) travels as a query param so
   * the same preview shows there.
   */
  protected proceedToPayment(): void {
    if (this.items().length === 0) {
      this.toast.error('Your cart is empty. Add items before checking out.');
      return;
    }
    const coupon = this.appliedCoupon();
    this.router.navigate(['/payment'], { queryParams: coupon ? { coupon: coupon.code } : {} });
  }
}
