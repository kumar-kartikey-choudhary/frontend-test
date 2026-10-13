import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CartService } from '../../../service/cart/CartService';
import { CouponService } from '../../../service/coupon/coupon-service';
import { ProductService } from '../../../service/product/product-service';
import { PaymentService } from '../../../service/payment/payment-service';
import { AddressService } from '../../../service/address/address-service';
import { UserService } from '../../../service/user/user-service';
import type { SavedPaymentMethodDto } from '../../../model/payment';
import { ToastService } from '../../../core/services/toast.service';
import type { CartItemDto } from '../../../model/cart.model';
import type { AddressDto } from '../../../model/address.model';
import type { CouponDto, DeliveryAddress } from '../../../model/order.model';
import type { PaymentMethod } from '../../../model/payment';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { PLACEHOLDER_IMAGE } from '../../../shared/uti/image.util';

/**
 * The order is only placed from here, once a delivery address and payment method are chosen -
 * see placeOrder(). The cart page just reviews items/coupon and hands off to this page.
 */
@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, ImgFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment.html',
  styleUrls: ['./payment.css'],
})
export class Payment implements OnInit {
  private readonly cart = inject(CartService);
  private readonly couponService = inject(CouponService);
  private readonly productService = inject(ProductService);
  private readonly paymentService = inject(PaymentService);
  private readonly addressService = inject(AddressService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly items = signal<CartItemDto[]>([]);
  protected readonly addresses = signal<AddressDto[]>([]);
  protected readonly selectedAddressId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly placingOrder = signal(false);

  // Carried over from the cart page via ?coupon=CODE - re-fetched here (not trusted blindly) so
  // the discount preview matches the cart page, and a stale code in the URL fails cleanly.
  protected readonly appliedCoupon = signal<CouponDto | null>(null);

  protected readonly paymentMethod = signal<PaymentMethod>('UPI');
  protected saveCard = false;

  /** Cards the customer saved earlier; empty if none (or if the list couldn't be loaded). */
  protected readonly savedCards = signal<SavedPaymentMethodDto[]>([]);
  /** The saved card chosen for this payment, or null to enter a new one. */
  protected readonly selectedCardId = signal<string | null>(null);

  private contactPhone: string | undefined;

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
  protected readonly selectedAddress = computed(
    () => this.addresses().find((a) => a.id === this.selectedAddressId()) ?? null,
  );

  /** Where "add an address" sends the customer, so they land back here afterwards. */
  protected addAddressQuery: Record<string, string> = { tab: 'addresses', returnUrl: '/payment' };

  ngOnInit(): void {
    const coupon = this.route.snapshot.queryParamMap.get('coupon');
    if (coupon) {
      this.addAddressQuery = {
        tab: 'addresses',
        returnUrl: `/payment?coupon=${encodeURIComponent(coupon)}`,
      };
    }
    this.load(coupon);
  }

  protected load(couponCode: string | null = this.route.snapshot.queryParamMap.get('coupon')): void {
    this.loading.set(true);
    this.failed.set(false);

    forkJoin({
      items: this.cart.getCart(),
      addresses: this.addressService.getAll().pipe(catchError(() => of([] as AddressDto[]))),
      phone: this.userService.me().pipe(catchError(() => of(null))),
      cards: this.paymentService.getSavedMethods().pipe(catchError(() => of([] as SavedPaymentMethodDto[]))),
      coupon: couponCode ? this.couponService.find(couponCode).pipe(catchError(() => of(null))) : of(null),
    }).subscribe({
      next: ({ items, addresses, phone, coupon, cards }) => {
        if (!items || items.length === 0) {
          this.toast.error('Your cart is empty.');
          this.router.navigate(['/cart']);
          return;
        }
        this.items.set(items);
        this.addresses.set(addresses);
        this.contactPhone = phone?.phoneNumber || undefined;
        this.savedCards.set(cards);
        this.selectedCardId.set((cards.find((c) => c.isDefault) ?? cards[0])?.id ?? null);
        // An invalid code in the URL is dropped rather than blocking checkout.
        this.appliedCoupon.set(coupon);
        const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
        this.selectedAddressId.set(preferred?.id ?? null);
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

  protected backToCart(): void {
    this.router.navigate(['/cart']);
  }

  protected selectCard(id: string | null): void {
    this.selectedCardId.set(id);
  }

  protected cardLabel(card: SavedPaymentMethodDto): string {
    const network = card.cardNetwork === 'OTHER' ? 'Card' : card.cardNetwork.charAt(0) + card.cardNetwork.slice(1).toLowerCase();
    const month = String(card.cardExpiryMonth ?? '').padStart(2, '0');
    const year = String(card.cardExpiryYear ?? '').slice(-2);
    return `${network} ending ${card.cardLastFour}` + (card.cardExpiryMonth ? ` · expires ${month}/${year}` : '');
  }

  protected selectMethod(method: PaymentMethod): void {
    this.paymentMethod.set(method);
  }

  private toDeliveryAddress(address: AddressDto): DeliveryAddress {
    return {
      label: address.label,
      line1: address.line1,
      line2: address.line2 || undefined,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark || undefined,
      contactPhone: this.contactPhone,
    };
  }

  /**
   * Places the order (via order-service) and then, for anything other than COD, runs the
   * Razorpay Checkout flow against payment-service. A failure after the order exists means the
   * payment didn't go through, not that the order failed - the customer can retry from My Orders.
   */
  protected placeOrder(): void {
    const address = this.selectedAddress();
    if (this.placingOrder() || this.items().length === 0) return;
    if (!address) {
      this.toast.error('Please choose a delivery address first.');
      return;
    }

    this.placingOrder.set(true);
    const method = this.paymentMethod();

    this.cart.placeOrder(this.appliedCoupon()?.code, this.toDeliveryAddress(address)).subscribe({
      next: async (order) => {
        // The order exists and stock is reserved whatever happens to the payment from here.
        this.cart.syncCartFromBackend();

        if (method === 'COD') {
          this.placingOrder.set(false);
          this.toast.success('Order placed! Pay in cash on delivery.');
          this.router.navigate(['/orders']);
          return;
        }

        try {
          await this.paymentService.payForOrder(order.id, order.totalAmount, method, {
            customerName: order.username,
            contact: this.contactPhone,
            saveCard: this.saveCard,
            savedPaymentMethodId: this.selectedCardId() ?? undefined,
          });
          this.toast.success('Payment successful! Your order is confirmed.');
        } catch (paymentError: unknown) {
          const reason = paymentError instanceof Error ? paymentError.message : 'cancelled';
          this.toast.error(
            `Order placed, but the payment didn't go through (${reason}). ` +
              'You can pay again from My Orders.',
          );
        }
        this.placingOrder.set(false);
        this.router.navigate(['/orders']);
      },
      // The interceptor already showed the server's message (e.g. which item is out of stock).
      error: () => this.placingOrder.set(false),
    });
  }
}
