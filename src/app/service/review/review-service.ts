import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ProductReviews, RatingSummary, ReviewDto } from '../../model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/products`;

  /** Average stars and review count per product, for the stars on catalogue cards. */
  private readonly summaries = signal<ReadonlyMap<string, RatingSummary>>(new Map());
  private loadedSummaries = false;

  summaryFor(productId: string): RatingSummary | undefined {
    return this.summaries().get(productId);
  }

  /** Loads the per-product ratings once (they change rarely); call again with force to refresh after a review. */
  loadSummaries(force = false): void {
    if (this.loadedSummaries && !force) return;
    this.loadedSummaries = true;
    this.http.get<RatingSummary[]>(`${this.apiUrl}/ratings`).subscribe({
      next: (rows) => this.summaries.set(new Map(rows.map((r) => [r.productId, r]))),
      error: () => (this.loadedSummaries = false),
    });
  }

  getReviews(productId: string): Observable<ProductReviews> {
    return this.http.get<ProductReviews>(`${this.apiUrl}/product/${productId}/reviews`);
  }

  /** Adds the customer's review, or replaces the one they wrote before. */
  save(productId: string, rating: number, comment: string): Observable<ReviewDto> {
    return this.http
      .post<ReviewDto>(`${this.apiUrl}/product/${productId}/reviews`, { rating, comment })
      .pipe(tap(() => this.loadSummaries(true)));
  }

  delete(reviewId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/reviews/${reviewId}`).pipe(tap(() => this.loadSummaries(true)));
  }
}
