import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../service/cart/CartService';
import { CouponService } from '../../service/coupon/coupon-service';
import { ProductService } from '../../service/product/product-service';
import { ToastService } from '../../core/services/toast.service';
import { CartItemDto } from '../../model/cart.model';
import type { CouponDto } from '../../model/order.model';

@Component({
  selector: 'app-shopping-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './shopping-cart.html',
  styleUrls: ['./shopping-cart.css'],
})
export class ShoppingCart implements OnInit {
  cartItems: CartItemDto[] = [];
  subtotalAmount = 0;
  discountAmount = 0;
  totalAmount = 0;
  totalCount = 0;
  isLoading = false;

  // Coupon state - applied client-side as a preview only. The real discount is always
  // recalculated server-side in OrderServiceImpl.create() at checkout. The chosen code is
  // carried forward to the payment page via a query param - see proceedToPayment().
  couponCodeInput = '';
  appliedCoupon: CouponDto | null = null;
  couponError = '';
  isApplyingCoupon = false;

  constructor(
    private cartService: CartService,
    private couponService: CouponService,
    private productService: ProductService,
    private toastService: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    this.isLoading = true;
    this.cartService.getCart().subscribe({
      next: (items: CartItemDto[]) => {
        this.cartItems = items || [];
        this.calculateTotals();
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error('Failed to load cart items');
        this.isLoading = false;
      },
    });
  }

  /** Build an <img src> from the product's primary image id - falls back to a placeholder. */
  imageUrlFor(item: CartItemDto): string {
    return item.productImageId
      ? this.productService.imageUrl(item.productImageId)
      : 'assets/images/placeholder.png';
  }

  calculateTotals(): void {
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

  applyCoupon(): void {
    const code = this.couponCodeInput.trim();
    if (!code) return;

    this.isApplyingCoupon = true;
    this.couponError = '';
    this.couponService.find(code).subscribe({
      next: (coupon) => {
        this.appliedCoupon = coupon;
        this.calculateTotals();
        this.isApplyingCoupon = false;
        if (this.discountAmount === 0) {
          this.couponError = "This code doesn't apply to your current cart.";
        }
      },
      error: () => {
        this.appliedCoupon = null;
        this.couponError = 'Invalid or expired coupon code.';
        this.calculateTotals();
        this.isApplyingCoupon = false;
      },
    });
  }

  removeCoupon(): void {
    this.appliedCoupon = null;
    this.couponCodeInput = '';
    this.couponError = '';
    this.calculateTotals();
  }

  increaseQuantity(item: CartItemDto): void {
    const newQty = item.quantity + 1;
    this.cartService.updateQuantity(item.productId, newQty).subscribe({
      next: (updatedDto: CartItemDto) => {
        item.quantity = newQty;
        item.subtotal = updatedDto?.subtotal ?? item.pricePerUnit * newQty;
        this.calculateTotals();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to update quantity');
      },
    });
  }

  decreaseQuantity(item: CartItemDto): void {
    if (item.quantity <= 1) {
      this.removeItem(item.productId);
      return;
    }
    const newQty = item.quantity - 1;
    this.cartService.updateQuantity(item.productId, newQty).subscribe({
      next: (updatedDto: CartItemDto) => {
        item.quantity = newQty;
        item.subtotal = updatedDto?.subtotal ?? item.pricePerUnit * newQty;
        this.calculateTotals();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to update quantity');
      },
    });
  }

  removeItem(productId: string): void {
    this.cartService.removeItem(productId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter((item) => item.productId !== productId);
        this.calculateTotals();
        this.toastService.success('Item removed from cart');
      },
      error: () => {
        this.toastService.error('Failed to remove item');
      },
    });
  }

  /**
   * Cart no longer places the order itself - it hands off to the dedicated payment page,
   * where the customer picks a payment method and then places the order. The coupon code
   * (if any) travels along as a query param so the payment page can re-apply the same
   * preview without the customer having to re-enter it.
   */
  proceedToPayment(): void {
    if (this.cartItems.length === 0) {
      this.toastService.error('Your cart is empty. Add items before checking out.');
      return;
    }

    this.router.navigate(['/payment'], {
      queryParams: this.appliedCoupon ? { coupon: this.appliedCoupon.code } : {},
    });
  }
}