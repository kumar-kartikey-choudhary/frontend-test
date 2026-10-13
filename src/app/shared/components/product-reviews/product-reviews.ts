import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../service/login/auth-service';
import { ReviewService } from '../../../service/review/review-service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import type { ProductReviews, ReviewDto } from '../../../model';
import { StarRating } from '../star-rating/star-rating';

/** A product's reviews: the average, everyone's comments, and a form for the signed-in customer's own. */
@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [FormsModule, DatePipe, StarRating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.css',
})
export class ProductReviewsSection {
  readonly productId = input.required<string>();

  private readonly reviewService = inject(ReviewService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly data = signal<ProductReviews | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly signedIn = this.auth.loggedIn;
  protected readonly isAdmin = this.auth.admin;
  protected readonly mine = computed(() => this.data()?.reviews.find((r) => r.mine) ?? null);

  // The form: shown for a first review, or when the customer chooses to edit theirs.
  protected readonly editing = signal(false);
  protected readonly rating = signal(0);
  protected comment = '';
  protected readonly submitting = signal(false);
  protected readonly ratingMissing = signal(false);

  /** Bumped to re-read the reviews after saving or deleting. */
  private readonly reloadTick = signal(0);

  constructor() {
    toObservable(computed(() => [this.productId(), this.auth.loggedIn(), this.reloadTick()] as const))
      .pipe(
        tap(() => {
          this.loading.set(this.data() === null);
          this.failed.set(false);
        }),
        // Signing in or out changes which review is "mine", so the list is re-read, not just re-labelled.
        switchMap(([id]) =>
          this.reviewService.getReviews(id).pipe(
            catchError(() => {
              this.failed.set(true);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((data) => {
        this.data.set(data);
        this.loading.set(false);
      });
  }

  protected setRating(value: number): void {
    this.rating.set(value);
    this.ratingMissing.set(false);
  }

  protected startEdit(review: ReviewDto): void {
    this.rating.set(review.rating);
    this.comment = review.comment ?? '';
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.rating.set(0);
    this.comment = '';
    this.ratingMissing.set(false);
  }

  protected goToLogin(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.rating() < 1) {
      this.ratingMissing.set(true);
      return;
    }
    this.submitting.set(true);
    this.reviewService.save(this.productId(), this.rating(), this.comment.trim()).subscribe({
      next: () => {
        this.toast.success(this.mine() ? 'Your review has been updated.' : 'Thanks for your review!');
        this.cancelEdit();
        this.submitting.set(false);
        this.reloadTick.update((n) => n + 1);
      },
      error: () => this.submitting.set(false),
    });
  }

  protected async remove(review: ReviewDto): Promise<void> {
    const ok = await this.confirm.confirm({
      title: review.mine ? 'Delete your review?' : 'Delete this review?',
      message: review.mine ? 'It will be removed from the product page.' : `This removes ${review.authorName}'s review for everyone.`,
      confirmText: 'Delete',
      cancelText: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    this.reviewService.delete(review.id).subscribe({
      next: () => {
        this.toast.success('Review deleted.');
        this.reloadTick.update((n) => n + 1);
      },
    });
  }
}
