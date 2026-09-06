import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CartService } from '../../../service/cart/CartService';
import { CouponService } from '../../../service/coupon/coupon-service';
import { ProductService } from '../../../service/product/product-service';
import { PaymentService } from '../../../service/payment/payment-service';
import { ToastService } from '../../../core/services/toast.service';
import { CartItemDto } from '../../../model/cart.model';
import type { CouponDto } from '../../../model/order.model';
import type { PaymentMethod } from '../../../model/payment';

/**
 * The order is only placed from here, once a payment method is chosen - see
 * placeOrder(). The cart page just reviews items/coupon and hands off to this
 * page (proceedToPayment()); it no longer creates the order itself.
 */
@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payment.html',
  styleUrls: ['./payment.css'],
})
export class Payment implements OnInit {
  cartItems: CartItemDto[] = [];
  subtotalAmount = 0;
  discountAmount = 0;
  totalAmount = 0;
  totalCount = 0;
  isLoading = true;
  isPlacingOrder = false;

  // Carried over from the cart page via ?coupon=CODE - re-fetched here (not trusted blindly)
  // so the discount preview shown matches what the cart page showed, and so a customer who
  // opens this page directly with a stale/invalid code in the URL gets a clean error instead
  // of a silently wrong total.
  appliedCoupon: CouponDto | null = null;

  selectedPaymentMethod: PaymentMethod = 'UPI';
  saveCard = false;

  constructor(
    private cartService: CartService,
    private couponService: CouponService,
    private productService: ProductService,
    private paymentService: PaymentService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const couponCode = this.route.snapshot.queryParamMap.get('coupon');
    this.loadCart(couponCode);
  }

  private loadCart(couponCode: string | null): void {
    this.isLoading = true;
    this.cartService.getCart().subscribe({
      next: (items) => {
        this.cartItems = items || [];

        if (this.cartItems.length === 0) {
          this.toastService.error('Your cart is empty.');
          this.router.navigate(['/cart']);
          return;
        }

        this.calculateTotals();

        if (couponCode) {
          this.couponService.find(couponCode).subscribe({
            next: (coupon) => {
              this.appliedCoupon = coupon;
              this.calculateTotals();
              this.isLoading = false;
            },
            error: () => {
              // Coupon from the URL no longer valid - proceed without it rather than blocking
              // checkout entirely.
              this.appliedCoupon = null;
              this.isLoading = false;
            },
          });
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.toastService.error('Failed to load your cart.');
        this.isLoading = false;
      },
    });
  }

  imageUrlFor(item: CartItemDto): string {
    return item.productImageId
      ? this.productService.imageUrl(item.productImageId)
      : 'assets/images/placeholder.png';
  }

  private calculateTotals(): void {
    this.totalCount = this.cartItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
    this.subtotalAmount = this.cartItems.reduce((acc, item) => {
      const lineSubtotal = item.subtotal != null ? item.subtotal : item.pricePerUnit * item.quantity;
      return acc + Number(lineSubtotal);
    }, 0);

    this.discountAmount = this.appliedCoupon
      ? this.couponService.estimateDiscount(this.appliedCoupon, this.subtotalAmount)
      : 0;
    this.totalAmount = Math.max(0, this.subtotalAmount - this.discountAmount);
  }

  backToCart(): void {
    this.router.navigate(['/cart']);
  }

  /**
   * Places the order (via order-service) and then, for anything other than COD, runs the
   * Razorpay Checkout flow against payment-service. See OrderServiceImpl.create()'s comment
   * for why order creation and payment are decoupled backend-side - a failure below means the
   * payment didn't go through, not that the order failed.
   */
  placeOrder(): void {
    if (this.isPlacingOrder || this.cartItems.length === 0) return;

    this.isPlacingOrder = true;

    this.cartService.placeOrder(this.appliedCoupon?.code).subscribe({
      next: async (order) => {
        // Order is placed and stock reserved at this point regardless of payment outcome.
        // Clear the cart now; a payment failure below doesn't undo the order.
        this.cartService.syncCartFromBackend();

        if (this.selectedPaymentMethod === 'COD') {
          this.isPlacingOrder = false;
          this.toastService.success('Order placed! Pay in cash on delivery.');
          this.router.navigate(['/orders']);
          return;
        }

        try {
          await this.paymentService.payForOrder(order.id, order.totalAmount, this.selectedPaymentMethod, {
            customerName: order.username,
            saveCard: this.saveCard,
          });
          this.isPlacingOrder = false;
          this.toastService.success('Payment successful! Your order is confirmed.');
          this.router.navigate(['/orders']);
        } catch (paymentError: any) {
          // The order already exists and stock is reserved - only the payment step failed or
          // was cancelled. Don't imply the order itself failed.
          this.isPlacingOrder = false;
          this.toastService.error(
            `Order placed, but payment didn't go through (${paymentError?.message || 'cancelled'}). ` +
              'You can retry payment from My Orders.',
          );
          this.router.navigate(['/orders']);
        }
      },
      error: (err) => {
        console.error('Order placement failed:', err);
        const message = err?.error?.message || 'Failed to place order. Some items may be out of stock.';
        this.toastService.error(message);
        this.isPlacingOrder = false;
      },
    });
  }
}