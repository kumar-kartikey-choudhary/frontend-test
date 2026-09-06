import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ProductService } from '../../service/product/product-service';
import type { OrderResponse } from '../../model';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.html',
  styleUrls: ['./my-orders.css'],
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
})
export class MyOrders implements OnInit {
  orders: OrderResponse[] = [];
  isLoading = true;
  errorMsg = '';

  private orderUrl = `${environment.apiBaseUrl}/orders/findByCustomer`;

  constructor(
    private http: HttpClient,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.http.get<OrderResponse[]>(this.orderUrl).subscribe({
      next: (data) => {
        // Newest first
        this.orders = [...data].sort(
          (a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime(),
        );
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'Could not load your orders. Please try again.';
        this.isLoading = false;
      },
    });
  }

  /** Build an <img src> from the product's primary image id - falls back to a placeholder. */
  itemImageUrl(imageId: string | undefined): string {
    return imageId ? this.productService.imageUrl(imageId) : 'assets/images/placeholder.png';
  }

  getItemWeightDisplay(item: any): string {
  // 1. If weight exists as an unmapped dynamic key on item
  if (item['weight']) return `${item['weight']} - ${item.quantity} qty`;
  if (item['unit']) return `${item['unit']} - ${item.quantity} qty`;

  // 2. Extract weight patterns directly from item.productName (e.g., "500g", "1kg", "250gm")
  const weightMatch = item.productName?.match(/\b(\d+\s*(?:gm|g|kg|ml|l|pack))\b/i);
  if (weightMatch) {
    return `${weightMatch[0]} - ${item.quantity} qty`;
  }

  // 3. Default fallback if no weight pattern is found
  return `${item.quantity} qty`;
}
}