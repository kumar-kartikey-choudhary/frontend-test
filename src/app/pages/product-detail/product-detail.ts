import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../service/product/product-service';
import { CartService } from '../../service/cart/CartService';
import { SeoService } from '../../core/services/seo.service';
import type { Product } from '../../model';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { ProductPurchase } from '../../shared/components/product-purchase/product-purchase';
import { ProductReviewsSection } from '../../shared/components/product-reviews/product-reviews';
import { StarRating } from '../../shared/components/star-rating/star-rating';
import { WishlistButton } from '../../shared/components/wishlist-button/wishlist-button';
import { ReviewService } from '../../service/review/review-service';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { PLACEHOLDER_IMAGE } from '../../shared/uti/image.util';
import { categoryLabel, categoryRoute } from '../../shared/uti/category.util';

/** Below this many stock units (kg, pcs ...) we tell the shopper stock is running low. */
const LOW_STOCK_UNITS = 5;

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, ProductCard, ProductPurchase, ImgFallbackDirective, ProductReviewsSection, StarRating, WishlistButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail {
  /** From the `:id` route parameter (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);
  private readonly reviews = inject(ReviewService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly product = signal<Product | null>(null);
  protected readonly related = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly failed = signal(false);
  private readonly selectedImageId = signal<string | null>(null);

  protected readonly images = computed(() =>
    [...(this.product()?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  protected readonly mainImage = computed(() => {
    const images = this.images();
    const chosen = images.find((i) => i.id === this.selectedImageId());
    const image = chosen ?? images.find((i) => i.primary) ?? images[0];
    return image ? this.productService.imageUrl(image.id) : PLACEHOLDER_IMAGE;
  });

  protected readonly rating = computed(() => {
    const id = this.product()?.id;
    return id ? this.reviews.summaryFor(id) : undefined;
  });

  protected readonly categoryName = computed(() => categoryLabel(this.product()?.category));
  protected readonly categoryLink = computed(() => categoryRoute(this.product()?.category));

  protected readonly stockNote = computed(() => {
    const p = this.product();
    if (!p) return null;
    if (p.available === false || p.stockQuantity <= 0) return { text: 'Out of stock', tone: 'out' };
    if (p.stockQuantity <= LOW_STOCK_UNITS) {
      return { text: `Only ${+p.stockQuantity.toFixed(2)} ${p.stockUnit} left`, tone: 'low' };
    }
    return { text: 'In stock', tone: 'ok' };
  });

  /** Bumped by reload() to re-run the lookup for the same id. */
  private readonly retry = signal(0);

  constructor() {
    this.reviews.loadSummaries();

    // switchMap drops an in-flight request when the id changes (e.g. clicking a related product
    // re-uses this component), so a slow earlier response can never overwrite a newer product.
    toObservable(computed(() => [this.id(), this.retry()] as const))
      .pipe(
        tap(() => this.beginLoad()),
        switchMap(([id]) =>
          this.productService.getProduct(id).pipe(
            catchError((err) => {
              this.product.set(null);
              this.notFound.set(err?.status === 404);
              this.failed.set(err?.status !== 404);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((product) => {
        this.product.set(product);
        this.loading.set(false);
        this.seo.update({
          title: product.productName,
          description: product.description || `Buy ${product.productName} from Pratik Dairy & Sweets.`,
        });
        this.loadRelated(product);
      });
  }

  protected selectImage(imageId: string): void {
    this.selectedImageId.set(imageId);
  }

  protected imageUrl(imageId: string): string {
    return this.productService.imageUrl(imageId);
  }

  protected reload(): void {
    this.retry.update((n) => n + 1);
  }

  private beginLoad(): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.failed.set(false);
    this.selectedImageId.set(null);
    this.cart.syncCartFromBackend();
  }

  private loadRelated(product: Product): void {
    this.related.set([]);
    this.productService
      .getProductsByCategory(product.category)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) =>
          this.related.set(list.filter((p) => p.id !== product.id && p.available !== false).slice(0, 4)),
        error: () => this.related.set([]),
      });
  }
}
