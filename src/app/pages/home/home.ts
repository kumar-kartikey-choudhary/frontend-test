import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../service/product/product-service';
import { CartService } from '../../service/cart/CartService';
import type { Product } from '../../model';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { isOutOfStock } from '../../shared/uti/stock.util';
import { environment } from '../../../environments/environment';

/** How many products to feature on the home page. */
const FEATURED_COUNT = 4;

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);

  // Worked out from the founding year so it is right every year without anyone editing it.
  protected readonly yearsInBusiness = Math.max(1, new Date().getFullYear() - environment.foundedYear);

  protected readonly featured = signal<Product[]>([]);
  protected readonly featuredLoading = signal(true);
  protected readonly skeletons = Array.from({ length: FEATURED_COUNT }, (_, i) => i);

  ngOnInit(): void {
    this.cart.syncCartFromBackend();
    this.productService.getAllProducts(true).subscribe({
      next: (products) => {
        // Prefer things the shop can actually sell right now, and that have a photo.
        const sellable = products.filter((p) => p.available !== false && !isOutOfStock(p));
        const withPhoto = sellable.filter((p) => p.images?.length);
        const pool = withPhoto.length >= FEATURED_COUNT ? withPhoto : sellable;
        this.featured.set(pool.slice(0, FEATURED_COUNT));
        this.featuredLoading.set(false);
      },
      // The section is a bonus - if the catalogue can't be reached the rest of the page still works.
      error: () => this.featuredLoading.set(false),
    });
  }
}
