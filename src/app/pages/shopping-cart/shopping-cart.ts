import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CartService } from '../../service/cart/CartService';
import type { CartItemDto } from '../../model';

@Component({
  selector: 'app-shopping-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shopping-cart.html',
  styleUrl: './shopping-cart.css',
})
export class ShoppingCart implements OnInit {
  cartItems: CartItemDto[] = [];
  isLoading = true;
  errorMsg = '';
  isCheckingOut = false;

  constructor(
    public cartService: CartService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.cartService.getCart().subscribe({
      next: (items) => {
        this.cartItems = items.map((item) => this.mapImageUrl(item));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load cart:', err);
        this.errorMsg = 'Could not load cart. Please try again.';
        this.isLoading = false;
      },
    });
  }

  private mapImageUrl(item: CartItemDto): CartItemDto {
    let finalImageUrl: string | SafeUrl = 'assets/images/placeholder.png';

    if (item.productImageUrl) {
      finalImageUrl = this.sanitizer.bypassSecurityTrustUrl(
        `data:image/jpeg;base64,${item.productImageUrl}`
      );
    }

    return { ...item, productImageUrl: finalImageUrl };
  }

  removeItem(productId: string): void {
    this.errorMsg = '';
    this.cartService.removeItem(productId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter((item) => item.productId !== productId);
        this.cartService.syncCartFromBackend(); // Keep header/global cart badge in sync
      },
      error: (err) => {
        console.error('Remove item failed:', err);
        this.errorMsg = 'Failed to remove item. Please try again.';
      },
    });
  }

  increaseQuantity(item: CartItemDto): void {
    this.errorMsg = '';
    const newQty = item.quantity + 1;
    
    this.cartService.updateQuantity(item.productId, newQty).subscribe({
      next: (updated: CartItemDto) => {
        item.quantity = updated.quantity;
        item.pricePerUnit = updated.pricePerUnit;
        item.subtotal = updated.subtotal;
        this.cartService.syncCartFromBackend();
      },
      error: (err) => {
        console.error('Quantity increase failed:', err);
        this.errorMsg = 'Insufficient stock available.';
      },
    });
  }

  decreaseQuantity(item: CartItemDto): void {
    if (item.quantity <= 1) {
      this.removeItem(item.productId);
      return;
    }

    this.errorMsg = '';
    const newQty = item.quantity - 1;

    this.cartService.updateQuantity(item.productId, newQty).subscribe({
      next: (updated: CartItemDto) => {
        item.quantity = updated.quantity;
        item.pricePerUnit = updated.pricePerUnit;
        item.subtotal = updated.subtotal;
        this.cartService.syncCartFromBackend();
      },
      error: (err) => {
        console.error('Quantity decrease failed:', err);
        this.errorMsg = 'Could not update quantity.';
      },
    });
  }

  checkout(): void {
    if (this.cartItems.length === 0) {
      this.errorMsg = 'Your cart is empty. Add items before checking out.';
      return;
    }

    this.errorMsg = '';
    this.isCheckingOut = true;

    this.cartService.checkout().subscribe({
      next: () => {
        this.cartItems = [];
        this.isCheckingOut = false;
        this.cartService.syncCartFromBackend();
        this.router.navigate(['/orders']);
      },
      error: (err) => {
        console.error('Checkout failed:', err);
        this.errorMsg = 'Failed to place order. Some items may be out of stock.';
        this.isCheckingOut = false;
      },
    });
  }

  get totalAmount(): number {
    return this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  get totalItems(): number {
    return this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  getWeight(item: CartItemDto): string {
    return item.weight || '1kg';
  }

  getUnitPrice(item: CartItemDto): number {
    return item.pricePerUnit;
  }
}