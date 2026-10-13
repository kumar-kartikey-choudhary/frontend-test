import { environment } from '../../../environments/environment';
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../login/auth-service';
import type { CartItemDto, AddToCart } from '../../model/cart.model';
import type { OrderResponse, DeliveryAddress } from '../../model/order.model';

export type { CartItemDto, AddToCart };

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly cartUrl = `${environment.apiBaseUrl}/carts`;
  private readonly orderUrl = `${environment.apiBaseUrl}/orders`;

  // Packs in the cart per line. A line is one product at one pack size, so the same product can
  // appear several times (e.g. 2 x 250g and 1 x 1kg) - see lineKey().
  private readonly lines = signal<Record<string, number>>({});
  // One in-flight flag per line, so a card can disable its own buttons while saving.
  private readonly busy = signal<Record<string, boolean>>({});

  /** Total packages in the cart - drives the badge in the header. */
  readonly itemCount = computed(() => Object.values(this.lines()).reduce((sum, qty) => sum + qty, 0));

  /** Identifies a cart line: the same product at a different pack size is a different line. */
  private lineKey(productId: string, weight: string): string {
    return `${productId}|${(weight ?? '').trim().toLowerCase()}`;
  }

  // ---------- Login guard ----------
  private requireLogin(): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return false;
    }
    return true;
  }

  // ---------- Internal state setters ----------
  private setBusy(key: string, value: boolean): void {
    this.busy.update((current) => ({ ...current, [key]: value }));
  }

  private setQty(key: string, qty: number): void {
    this.lines.update((current) => {
      const next = { ...current };
      if (qty <= 0) {
        delete next[key];
      } else {
        next[key] = qty;
      }
      return next;
    });
  }

  // ---------- Backend sync ----------
  syncCartFromBackend(): void {
    if (!this.authService.isLoggedIn()) {
      this.reset();
      return;
    }
    this.getCart().subscribe({
      next: (items) => {
        const state: Record<string, number> = {};
        items.forEach((item) => (state[this.lineKey(item.productId, item.weight)] = item.quantity));
        this.lines.set(state);
      },
      error: () => {
        /* the error interceptor already told the user */
      },
    });
  }

  /** Forget everything held locally - called on logout. */
  reset(): void {
    this.lines.set({});
    this.busy.set({});
  }

  // ---------- Actions used directly by components ----------

  /**
   * Add to cart - login check + API call + state update, all in one place.
   * `weight` is the selected pack size (e.g. "250g", "500g", "1kg"). Adding a pack size that is
   * already in the cart adds to that line; a different pack size becomes its own line.
   */
  addToCart(productId: string, weight: string, quantity = 1): void {
    if (!this.requireLogin()) return;

    const key = this.lineKey(productId, weight);
    this.setBusy(key, true);
    this.addItemToCart(productId, weight, quantity)
      .pipe(finalize(() => this.setBusy(key, false)))
      .subscribe({
        next: (line) => this.setQty(key, line?.quantity ?? this.getQuantity(productId, weight) + quantity),
        error: () => {
          /* e.g. 409 "only 2 kg available" - shown by the error interceptor */
        },
      });
  }

  increment(productId: string, weight: string): void {
    this.changeQuantity(productId, weight, this.getQuantity(productId, weight) + 1);
  }

  decrement(productId: string, weight: string): void {
    this.changeQuantity(productId, weight, this.getQuantity(productId, weight) - 1);
  }

  private changeQuantity(productId: string, weight: string, newQty: number): void {
    if (!this.requireLogin()) return;

    const key = this.lineKey(productId, weight);
    this.setBusy(key, true);
    const request$: Observable<unknown> =
      newQty <= 0 ? this.removeItem(productId, weight) : this.updateQuantity(productId, weight, newQty);
    request$.pipe(finalize(() => this.setBusy(key, false))).subscribe({
      next: () => this.setQty(key, newQty),
      error: () => {},
    });
  }

  /** Lets a page that already holds fresh cart data (e.g. the cart page) keep the header badge in step. */
  setLocalQuantity(productId: string, weight: string, quantity: number): void {
    this.setQty(this.lineKey(productId, weight), quantity);
  }

  /** The pack sizes of one product currently in the cart, e.g. [{ weight: '250g', quantity: 2 }, ...]. */
  linesOf(productId: string): { weight: string; quantity: number }[] {
    const prefix = `${productId}|`;
    return Object.entries(this.lines())
      .filter(([key, qty]) => key.startsWith(prefix) && qty > 0)
      .map(([key, quantity]) => ({ weight: key.slice(prefix.length), quantity }));
  }

  isInCart(productId: string, weight?: string): boolean {
    return weight === undefined ? this.linesOf(productId).length > 0 : this.getQuantity(productId, weight) > 0;
  }

  getQuantity(productId: string, weight: string): number {
    return this.lines()[this.lineKey(productId, weight)] || 0;
  }

  isLoading(productId: string, weight: string): boolean {
    return this.busy()[this.lineKey(productId, weight)] || false;
  }

  // ---------- Raw API calls ----------

  getCart(): Observable<CartItemDto[]> {
    return this.http.get<CartItemDto[]>(this.cartUrl);
  }

  addItemToCart(productId: string, weight: string, quantity: number): Observable<CartItemDto> {
    const payload: AddToCart = { productId, quantity, weight };
    return this.http.post<CartItemDto>(`${this.cartUrl}/items`, payload);
  }

  updateQuantity(productId: string, weight: string, newQty: number): Observable<CartItemDto> {
    return this.http.patch<CartItemDto>(
      `${this.cartUrl}/items/${productId}`,
      {},
      { params: { quantity: String(newQty), weight } },
    );
  }

  /** Empties the whole cart in one call. */
  clearCart(): Observable<void> {
    return this.http.delete<void>(`${this.cartUrl}/clear`).pipe(tap(() => this.reset()));
  }

  /** Removes one pack size of a product, or - with no weight - every line of it. */
  removeItem(productId: string, weight?: string): Observable<void> {
    return this.http
      .delete<void>(`${this.cartUrl}/items/${productId}`, { params: weight ? { weight } : {} })
      .pipe(
        tap(() => {
          if (weight) {
            this.setQty(this.lineKey(productId, weight), 0);
          } else {
            this.linesOf(productId).forEach((line) => this.setQty(this.lineKey(productId, line.weight), 0));
          }
        }),
      );
  }

  /**
   * Creates the order (stock reserved, order-service is the source of truth from here).
   * Called from the Payment page after the customer picks an address and payment method.
   * couponCode is optional; omit it to skip the discount. deliveryAddress is required by the
   * backend for new orders.
   */
  placeOrder(couponCode: string | undefined, deliveryAddress: DeliveryAddress): Observable<OrderResponse> {
    // Typed explicitly: an inferred union type makes HttpClient's post<T>() overload resolution
    // silently fall back to the arraybuffer overload.
    const params: Record<string, string> = couponCode ? { couponCode } : {};
    return this.http.post<OrderResponse>(`${this.orderUrl}/create`, deliveryAddress, { params });
  }
}
