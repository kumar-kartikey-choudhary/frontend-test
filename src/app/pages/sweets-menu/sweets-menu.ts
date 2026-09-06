import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../service/product/product-service';
import { CartService } from '../../service/cart/CartService';
import type { Product } from '../../model';

interface SweetCategory {
  name: string;
  items: Product[];
}

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

@Component({
  selector: 'app-sweets-menu',
  templateUrl: './sweets-menu.html',
  styleUrls: ['./sweets-menu.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
})
export class SweetsMenu implements OnInit {
  filterText = '';
  allSweets: Product[] = [];
  isLoading = false;

  constructor(
    private productService: ProductService,
    public cartService: CartService,
  ) {}

  ngOnInit(): void {
    this.loadSweets();
    this.cartService.syncCartFromBackend();
  }

  loadSweets(): void {
    this.isLoading = true;
    // 'Sweets' matches the backend Category enum (product-api / enums/Category.java).
    this.productService.getProductsByCategory('Sweets').subscribe({
      next: (data) => {
        this.allSweets = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load sweets from API:', err);
        this.isLoading = false;
      },
    });
  }

  /** Build an <img src> from the product's primary image id - falls back to a placeholder. */
  imageUrlFor(product: Product): string {
    const primary = product.images?.find((i) => i.primary) ?? product.images?.[0];
    return primary ? this.productService.imageUrl(primary.id) : 'assets/images/placeholder.png';
  }

  get groupedByType(): SweetCategory[] {
    const grouped: Record<string, Product[]> = {};

    for (const sweet of this.allSweets) {
      const typeKey = sweet.type || 'Other';
      (grouped[typeKey] ??= []).push(sweet);
    }

    return Object.keys(grouped)
      .map((key) => ({
        name: TYPE_DISPLAY_NAMES[key] || `${key.replace('_', ' ')} Collection`,
        items: grouped[key].sort((a, b) => a.productName.localeCompare(b.productName)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get filteredCategories(): SweetCategory[] {
    const filter = this.filterText.toLowerCase().trim();
    const groupedMenu = this.groupedByType;

    if (!filter) return groupedMenu;

    return groupedMenu
      .map((category) => ({
        ...category,
        items: category.items.filter((s) => s.productName.toLowerCase().includes(filter)),
      }))
      .filter((category) => category.items.length > 0);
  }
}