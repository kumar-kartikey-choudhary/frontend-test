import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../service/wishlist/wishlist-service';
import type { Product } from '../../model';
import { ProductCard } from '../../shared/components/product-card/product-card';

/** The products the customer has saved. A heart switched off here removes the card straight away. */
@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [RouterLink, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class Wishlist implements OnInit {
  private readonly wishlist = inject(WishlistService);

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  /** Hearts toggled on this page show up here at once: a product un-saved disappears, and comes back if re-saved. */
  protected readonly visible = computed(() => this.products().filter((p) => this.wishlist.isSaved(p.id)));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.wishlist.list().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
