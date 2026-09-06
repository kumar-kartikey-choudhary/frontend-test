import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../service/product/product-service';
import { CartService } from '../../service/cart/CartService';
import type { Product } from '../../model';

@Component({
  selector: 'app-cold-drinks',
  templateUrl: './cold-drinks.html',
  styleUrls: ['./cold-drinks.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
})
export class ColdDrinks implements OnInit {
  filterText = '';
  products: Product[] = [];
  isLoading = false;

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
    // 'Cold_Drinks' matches the backend Category enum (product-api / enums/Category.java).
    this.productService.getProductsByCategory('Cold_Drinks').subscribe({
      next: (data) => {
        this.products = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load cold drinks:', err);
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
}