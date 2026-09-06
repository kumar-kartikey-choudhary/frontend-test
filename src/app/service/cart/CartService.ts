import { environment } from '../../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../login/auth-service';
import type { CartItemDto, AddToCart } from '../../model/cart.model';
import type { OrderResponse } from '../../model/order.model';

export type { CartItemDto, AddToCart };

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartUrl = `${environment.apiBaseUrl}/carts`;
  private orderUrl = `${environment.apiBaseUrl}/orders`;

  // Global cart quantity state, keyed by productId. There's no weight-variant dimension
  // anymore - a product IS its own unit, so one cart line per product per user.
  private cartStateSubject = new BehaviorSubject<{ [productId: string]: number }>({});
  cartState$ = this.cartStateSubject.asObservable();

  // Global loading state - one flag per product.
  private loadingStateSubject = new BehaviorSubject<{ [productId: string]: boolean }>({});
  loadingState$ = this.loadingStateSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
  ) {}

  // ---------- Login Guard ----------
  private requireLogin(): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }

  // ---------- Internal state setters ----------
  private setLoading(productId: string, value: boolean): void {
    this.loadingStateSubject.next({ ...this.loadingStateSubject.value, [productId]: value });
  }

  private setCartQty(productId: string, qty: number): void {
    const current = { ...this.cartStateSubject.value };
    if (qty <= 0) {
      delete current[productId];
    } else {
      current[productId] = qty;
    }
    this.cartStateSubject.next(current);
  }

  // ---------- Backend sync ----------
  syncCartFromBackend(): void {
    this.getCart().subscribe({
      next: (items) => {
        const state: { [productId: string]: number } = {};
        items.forEach((item) => (state[item.productId] = item.quantity));
        this.cartStateSubject.next(state);
      },
      error: (err) => console.error('Could not load cart:', err),
    });
  }

  // ---------- Global cart actions (used directly by components) ----------

  /** Add to cart - login check + API call + state update, all in one place */
  addToCart(productId: string, quantity: number = 1): void {
    if (!this.requireLogin()) return;

    this.setLoading(productId, true);
    this.addItemToCart(productId, quantity).subscribe({
      next: () => {
        this.setCartQty(productId, quantity);
        this.setLoading(productId, false);
      },
      error: (err) => {
        console.error('Add to cart failed:', err);
        this.setLoading(productId, false);
      },
    });
  }

  /** Quantity +1 */
  increment(productId: string): void {
    if (!this.requireLogin()) return;
    const newQty = (this.cartStateSubject.value[productId] || 0) + 1;
    this.updateQuantity(productId, newQty).subscribe({
      next: () => this.setCartQty(productId, newQty),
      error: (err) => console.error('Update failed:', err),
    });
  }

  /** Quantity -1, removes the line at 0 */
  decrement(productId: string): void {
    if (!this.requireLogin()) return;
    const newQty = (this.cartStateSubject.value[productId] || 0) - 1;
    if (newQty <= 0) {
      this.removeItem(productId).subscribe({
        next: () => this.setCartQty(productId, 0),
        error: (err) => console.error('Remove failed:', err),
      });
    } else {
      this.updateQuantity(productId, newQty).subscribe({
        next: () => this.setCartQty(productId, newQty),
        error: (err) => console.error('Update failed:', err),
      });
    }
  }

  isInCart(productId: string): boolean {
    return (this.cartStateSubject.value[productId] || 0) > 0;
  }

  getQuantity(productId: string): number {
    return this.cartStateSubject.value[productId] || 0;
  }

  isLoading(productId: string): boolean {
    return this.loadingStateSubject.value[productId] || false;
  }

  // ---------- Raw API calls (payment.ts uses getCart()/placeOrder() directly) ----------

  getCart(): Observable<CartItemDto[]> {
    return this.http.get<CartItemDto[]>(this.cartUrl);
  }

  addItemToCart(productId: string, quantity: number): Observable<CartItemDto> {
    const payload: AddToCart = { productId, quantity };
    return this.http.post<CartItemDto>(`${this.cartUrl}/items`, payload);
  }

  updateQuantity(productId: string, newQty: number): Observable<CartItemDto> {
    return this.http.patch<CartItemDto>(`${this.cartUrl}/items/${productId}?quantity=${newQty}`, {});
  }

  removeItem(productId: string): Observable<void> {
    return this.http.delete<void>(`${this.cartUrl}/items/${productId}`);
  }

  /**
   * Creates the order (stock reserved, order-service is the source of truth from here).
   * Called from the Payment page (Payment.placeOrder()) after the customer picks a payment
   * method - the cart page itself only reviews items and hands off via router navigation to
   * /payment, it no longer calls this. couponCode is optional; omit it to skip the discount.
   */
  placeOrder(couponCode?: string): Observable<OrderResponse> {
    // Must be explicitly typed (not inferred from a ternary) - an inferred union type like
    // `{couponCode: string} | {}` makes TypeScript unable to match HttpClient's post<T>()
    // overload for `params`, and it silently falls back to a completely different overload
    // (the raw responseType: 'arraybuffer' one) - hence the confusing "Observable<ArrayBuffer>
    // is not assignable to Observable<OrderResponse>" error. Same fix already applied in
    // order-admin-service.ts.
    const params: Record<string, string> = couponCode ? { couponCode } : {};
    return this.http.post<OrderResponse>(`${this.orderUrl}/create`, {}, { params });
  }
}