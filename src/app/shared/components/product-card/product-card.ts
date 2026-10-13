import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../service/product/product-service';
import type { Product } from '../../../model';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { PLACEHOLDER_IMAGE } from '../../uti/image.util';
import { isOutOfStock } from '../../uti/stock.util';
import { ProductPurchase } from '../product-purchase/product-purchase';
import { ReviewService } from '../../../service/review/review-service';
import { StarRating } from '../star-rating/star-rating';
import { WishlistButton } from '../wishlist-button/wishlist-button';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, ImgFallbackDirective, ProductPurchase, StarRating, WishlistButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  readonly product = input.required<Product>();
  /** Optional corner label, e.g. the sweet's sub-category. */
  readonly tag = input<string | null>(null);

  private readonly productService = inject(ProductService);
  private readonly reviews = inject(ReviewService);

  constructor() {
    this.reviews.loadSummaries(); // once for the whole page: the first card asks, the rest reuse it
  }

  protected readonly rating = computed(() => this.reviews.summaryFor(this.product().id));

  protected readonly soldOut = computed(() => isOutOfStock(this.product()));
  protected readonly imageUrl = computed(() => {
    const images = this.product().images ?? [];
    const primary = images.find((i) => i.primary) ?? images[0];
    return primary ? this.productService.imageUrl(primary.id) : PLACEHOLDER_IMAGE;
  });
}
