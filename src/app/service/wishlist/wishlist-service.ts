import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Product } from '../../model';
import { AuthService } from '../login/auth-service';

/**
 * The signed-in customer's wishlist. The set of saved product ids is kept in a signal so every heart button
 * on every page agrees, and is reloaded when someone signs in and cleared when they sign out.
 */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiBaseUrl}/products/wishlist`;

  private readonly saved = signal<ReadonlySet<string>>(new Set());
  private readonly busy = signal<ReadonlySet<string>>(new Set());

  readonly count = computed(() => this.saved().size);

  constructor() {
    effect(() => {
      const loggedIn = this.auth.loggedIn();
      untracked(() => (loggedIn ? this.refresh() : this.saved.set(new Set())));
    });
  }

  isSaved(productId: string): boolean {
    return this.saved().has(productId);
  }

  isBusy(productId: string): boolean {
    return this.busy().has(productId);
  }

  refresh(): void {
    this.http.get<string[]>(`${this.apiUrl}/ids`).subscribe({
      next: (ids) => this.saved.set(new Set(ids)),
      error: () => undefined,
    });
  }

  /** The saved products themselves, for the wishlist page. */
  list(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl).pipe(tap((products) => this.saved.set(new Set(products.map((p) => p.id)))));
  }

  /** Saves the product, or un-saves it if it already is. The heart flips at once and goes back if the server refuses. */
  toggle(productId: string): void {
    if (this.isBusy(productId)) return;
    const wasSaved = this.isSaved(productId);
    this.setSaved(productId, !wasSaved);
    this.setBusy(productId, true);
    const request$ = wasSaved
      ? this.http.delete<void>(`${this.apiUrl}/${productId}`)
      : this.http.post<void>(`${this.apiUrl}/${productId}`, {});
    request$.subscribe({
      next: () => this.setBusy(productId, false),
      error: () => {
        this.setSaved(productId, wasSaved);
        this.setBusy(productId, false);
      },
    });
  }

  private setSaved(productId: string, on: boolean): void {
    this.saved.update((current) => {
      const next = new Set(current);
      if (on) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }

  private setBusy(productId: string, on: boolean): void {
    this.busy.update((current) => {
      const next = new Set(current);
      if (on) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }
}
