import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../service/product/product-service';
import { CartService } from '../../service/cart/CartService';
import type { Product } from '../../model';
import {
  SELECTABLE_WEIGHTS,
  defaultWeightFor,
  priceForWeight,
} from '../../shared/uti/weight-pricing.util';

@Component({
  selector: 'app-snacks-and-namkeens',
  templateUrl: './snacks-and-namkeens.html',
  styleUrls: ['./snacks-and-namkeens.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
})
export class SnacksAndNamkeens implements OnInit {
  filterText = '';
  products: Product[] = [];
  isLoading = false;

  readonly weightOptions = SELECTABLE_WEIGHTS;
  /** Selected weight variant per productId - defaults to the product's own unit. */
  private selectedWeights: { [productId: string]: string } = {};

  constructor(
    private productService: ProductService,
    public cartService: CartService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.cartService.syncCartFromBackend();
  }

  loadProducts(): void {
    this.isLoading = true;
    // 'Snacks' matches the backend Category enum (product-api / enums/Category.java).
    this.productService.getProductsByCategory('Snacks').subscribe({
      next: (data) => {
        this.products = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load snacks:', err);
        this.isLoading = false;
      },
    });
  }

  /** Build an <img src> from the product's primary image id - falls back to a placeholder. */
  imageUrlFor(product: Product): string {
    const primary = product.images?.find((i) => i.primary) ?? product.images?.[0];
    return primary ? this.productService.imageUrl(primary.id) : 'assets/images/placeholder.png';
  }

  get filteredProducts(): Product[] {
    const filter = this.filterText.toLowerCase().trim();
    if (!filter) return this.products;
    return this.products.filter((p) => p.productName.toLowerCase().includes(filter));
  }

  /** Currently selected weight for this product's card (defaults to its own stockUnit). */
  getSelectedWeight(product: Product): string {
    return this.selectedWeights[product.id] ?? defaultWeightFor(product.stockUnit);
  }

  selectWeight(product: Product, weight: string): void {
    this.selectedWeights = { ...this.selectedWeights, [product.id]: weight };
  }

  /** Price for this product at the currently selected weight - mirrors WeightPricing.priceFor() on the backend. */
  priceFor(product: Product): number {
    return priceForWeight(product.price, this.getSelectedWeight(product), product.stockUnit);
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product.id, this.getSelectedWeight(product));
  }
}