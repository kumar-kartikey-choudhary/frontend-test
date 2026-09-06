import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { InventoryLedgerEntry, InventoryReason, Product } from '../../model';

export type { Product };

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/products`;

  /** Cached catalogue so navigating between category pages doesn't refetch. */
  private catalogue$?: Observable<Product[]>;

  // --- Products ---

  addProduct(productData: Partial<Product>): Observable<Product> {
    return this.http
      .post<Product>(`${this.apiUrl}/addProduct`, productData)
      .pipe(tap(() => this.invalidateCache()));
  }

  /** Retrieve the product catalogue (cached until something mutates it). */
  getAllProducts(forceRefresh = false): Observable<Product[]> {
    if (forceRefresh || !this.catalogue$) {
      this.catalogue$ = this.http
        .get<Product[]>(`${this.apiUrl}/all`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.catalogue$;
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/product/${id}`);
  }

  getProductsByCategory(category: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/category/${category}`);
  }

  searchProducts(name: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/search`, { params: { name } });
  }

  updateProduct(productId: string, productData: Partial<Product>): Observable<Product> {
    return this.http
      .patch<Product>(`${this.apiUrl}/admin/updateProduct/${productId}`, productData)
      .pipe(tap(() => this.invalidateCache()));
  }

  deleteProduct(productId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/admin/deleteProduct/${productId}`)
      .pipe(tap(() => this.invalidateCache()));
  }

  invalidateCache(): void {
    this.catalogue$ = undefined;
  }

  // --- Images (a product can now have several; call once per photo) ---

  addImage(productId: string, imageFile: File, primary = false): Observable<Product> {
    const formData = new FormData();
    formData.append('imageFile', imageFile, imageFile.name);
    return this.http
      .post<Product>(`${this.apiUrl}/admin/${productId}/images`, formData, { params: { primary } })
      .pipe(tap(() => this.invalidateCache()));
  }

  /** URL for an `<img [src]>` binding - not an HttpClient call, the browser fetches it directly. */
  imageUrl(imageId: string): string {
    return `${this.apiUrl}/images/${imageId}`;
  }

  deleteImage(imageId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/admin/images/${imageId}`)
      .pipe(tap(() => this.invalidateCache()));
  }

  // --- Stock / inventory ledger (admin) ---

  adjustStock(productId: string, changeQty: number, reason: InventoryReason): Observable<InventoryLedgerEntry> {
    return this.http
      .post<InventoryLedgerEntry>(`${this.apiUrl}/admin/${productId}/adjust-stock`, null, {
        params: { changeQty, reason },
      })
      .pipe(tap(() => this.invalidateCache()));
  }

  getLedger(productId: string): Observable<InventoryLedgerEntry[]> {
    return this.http.get<InventoryLedgerEntry[]>(`${this.apiUrl}/admin/${productId}/ledger`);
  }
}