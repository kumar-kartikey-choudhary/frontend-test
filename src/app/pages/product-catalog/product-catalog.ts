import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { ProductService } from '../../service/product/product-service';
import { CartService } from '../../service/cart/CartService';
import { SeoService } from '../../core/services/seo.service';
import type { Product } from '../../model';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { priceForWeight, defaultWeightFor } from '../../shared/uti/weight-pricing.util';
import { isOutOfStock } from '../../shared/uti/stock.util';
import type { CatalogConfig } from './catalog.config';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

interface ProductGroup {
  name: string;
  items: Product[];
}

const PAGE_SIZE = 24;

const TYPE_DISPLAY_NAMES: Record<string, string> = {
  Kaju: 'Kaju Delights',
  Barfee: 'Barfee & Milk Cakes',
  Peda: 'Peda & Milk Sweets',
  Laddoo: 'Laddoo Collection',
  Chenna: 'Chenna Sweets',
  Dry_Fruit: 'Dry Fruit & Healthy',
  Gulab_Jamun: 'Gulab Jamun & Hot Sweets',
  Jalebi: 'Jalebi',
};

/**
 * One listing page for every category. Replaces five near-identical components (and their
 * 300-600 line stylesheets); what differs per category lives in {@link CatalogConfig}, supplied
 * through route data.
 */
@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [RouterLink, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-catalog.html',
  styleUrl: './product-catalog.css',
})
export class ProductCatalog implements OnInit {
  /** Bound from the route's `data: { config }` (withComponentInputBinding is enabled). */
  readonly config = input.required<CatalogConfig>();

  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  private readonly products = signal<Product[]>([]);

  /** What the user has typed (updates instantly); `query` follows it after a short pause. */
  protected readonly searchText = signal('');
  private readonly query = signal('');
  private readonly typing$ = new Subject<string>();

  protected readonly sort = signal<SortKey>('featured');
  protected readonly inStockOnly = signal(false);
  protected readonly visible = signal(PAGE_SIZE);

  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    let list = this.products();
    if (q) list = list.filter((p) => p.productName.toLowerCase().includes(q));
    if (this.inStockOnly()) list = list.filter((p) => !isOutOfStock(p));
    return this.sorted(list);
  });

  protected readonly shown = computed(() => this.filtered().slice(0, this.visible()));
  protected readonly hasMore = computed(() => this.filtered().length > this.visible());

  protected readonly groups = computed<ProductGroup[]>(() => {
    if (!this.config().groupByType) return [];
    const byType = new Map<string, Product[]>();
    for (const p of this.shown()) {
      const key = p.type || 'Other';
      byType.set(key, [...(byType.get(key) ?? []), p]);
    }
    return [...byType.entries()]
      .map(([key, items]) => ({
        name: TYPE_DISPLAY_NAMES[key] ?? `${key.replace(/_/g, ' ')} Collection`,
        items,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly filtersActive = computed(() => !!this.query().trim() || this.inStockOnly());

  constructor() {
    this.typing$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.query.set(value);
        this.visible.set(PAGE_SIZE);
      });
  }

  ngOnInit(): void {
    const { title, seoDescription } = this.config();
    this.seo.update({ title, description: seoDescription });
    this.cart.syncCartFromBackend();
    this.load();
  }

  protected load(): void {
    const { categories, excludeCategories } = this.config();
    this.loading.set(true);
    this.failed.set(false);

    // Always fetched fresh (not from the shared catalogue cache): stock changes as others buy.
    const request$ = categories.length
      ? forkJoin(categories.map((c) => this.productService.getProductsByCategory(c))).pipe(
          map((lists) => lists.flat()),
        )
      : this.productService
          .getAllProducts(true)
          .pipe(map((all) => all.filter((p) => !(excludeCategories ?? []).includes(p.category))));

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        this.products.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected onSearch(value: string): void {
    this.searchText.set(value);
    this.typing$.next(value);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.query.set('');
    this.inStockOnly.set(false);
    this.visible.set(PAGE_SIZE);
  }

  protected showMore(): void {
    this.visible.update((n) => n + PAGE_SIZE);
  }

  protected setSort(value: string): void {
    this.sort.set(value as SortKey);
  }

  protected toggleInStock(): void {
    this.inStockOnly.update((v) => !v);
    this.visible.set(PAGE_SIZE);
  }

  private sorted(list: Product[]): Product[] {
    const byName = (a: Product, b: Product) => a.productName.localeCompare(b.productName);
    // Sort by what the shopper sees first: the price at the default pack size.
    const price = (p: Product) => priceForWeight(p.price, defaultWeightFor(p.stockUnit), p.stockUnit);
    switch (this.sort()) {
      case 'price-asc':
        return [...list].sort((a, b) => price(a) - price(b) || byName(a, b));
      case 'price-desc':
        return [...list].sort((a, b) => price(b) - price(a) || byName(a, b));
      case 'name':
        return [...list].sort(byName);
      default:
        // "Featured": in-stock items first, then alphabetical.
        return [...list].sort(
          (a, b) => Number(isOutOfStock(a)) - Number(isOutOfStock(b)) || byName(a, b),
        );
    }
  }
}
