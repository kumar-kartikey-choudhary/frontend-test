// src/app/admin/pages/admin-dashboard/admin-dashboard.component.ts

import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../service/admin-service';
import { OrderAdminService, OrderResponse } from '../../service/order-admin-service';
import { ProductService } from '../../../service/product/product-service';

interface Kpi {
  title: string;
  value: string;
  detail: string;
  colorClass: 'primary' | 'success' | 'danger' | 'info';
}

interface RecentOrderRow {
  id: string;
  customer: string;
  total: number;
  status: string;
}

interface StockItem {
  name: string;
  stock: number;
  unit: string;
  threshold: number;
}

// No stock-threshold field exists on the backend Product model — this is a client-side
// assumption for "low stock" flagging. Adjust to match your actual reorder policy, or
// wire it up to a real field if one gets added to the product entity later.
const LOW_STOCK_THRESHOLD = 10;

/** How many orders / products the dashboard lists. */
const RECENT_ROWS = 10;

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  standalone: true,
  imports: [RouterLink, DecimalPipe],
})
export class AdminDashboardComponent implements OnInit {
  kpis: Kpi[] = [];
  recentOrders: RecentOrderRow[] = [];
  stockItems: StockItem[] = [];

  isLoading = true;
  errorMsg = '';

  constructor(
    private adminService: AdminService,
    private orderAdminService: OrderAdminService,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.errorMsg = '';

    forkJoin({
      orders: this.orderAdminService.getAllOrders(),
      products: this.productService.getAllProducts(),
      users: this.adminService.getAllUsers(),
    }).subscribe({
      next: ({ orders, products, users }) => {
        this.buildKpis(orders, products as any[], users as any[]);
        this.buildRecentOrders(orders);
        this.buildStockItems(products as any[]);
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'Could not load dashboard data.';
        this.isLoading = false;
      },
    });
  }

  /** Badge colour for an order status. */
  stockBadge(item: StockItem): string {
    if (item.stock <= 0) return 'adm-badge--danger';
    if (item.stock <= item.threshold) return 'adm-badge--warning';
    return 'adm-badge--success';
  }

  stockLabel(item: StockItem): string {
    if (item.stock <= 0) return 'Out of stock';
    return `${item.stock} ${item.unit} left`.replace('  ', ' ').trim();
  }

  badgeFor(status: string): string {
    switch (status.toUpperCase()) {
      case 'DELIVERED':
        return 'adm-badge--success';
      case 'CANCELLED':
        return 'adm-badge--danger';
      case 'SHIPPED':
        return 'adm-badge--info';
      case 'CONFIRMED':
        return 'adm-badge--brand';
      default:
        return 'adm-badge--warning';
    }
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private daysAgo(date: Date, days: number): boolean {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date.getTime() >= cutoff.getTime();
  }

  private buildKpis(orders: OrderResponse[], products: any[], users: any[]): void {
    const today = new Date();

    const todaysOrders = orders.filter((o) =>
      this.isSameDay(new Date(o.orderDateTime), today),
    );

    // Revenue from the last 7 days, excluding cancelled orders
    const weeklyRevenue = orders
      .filter((o) => o.status !== 'CANCELLED' && this.daysAgo(new Date(o.orderDateTime), 7))
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const lowStockProducts = products.filter((p) => p.stockQuantity <= LOW_STOCK_THRESHOLD);

    const newCustomers = users.filter((u) => u.createdAt && this.daysAgo(new Date(u.createdAt), 7));

    this.kpis = [
      {
        title: "Today's Orders",
        value: `${todaysOrders.length}`,
        detail: `${orders.length} total all-time`,
        colorClass: 'primary',
      },
      {
        title: 'Weekly Revenue',
        value: `₹ ${weeklyRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        detail: 'Last 7 days',
        colorClass: 'success',
      },
      {
        title: 'Low Stock Alerts',
        value: `${lowStockProducts.length}`,
        detail:
          lowStockProducts.length > 0
            ? lowStockProducts.map((p) => p.productName).slice(0, 2).join(', ')
            : 'All stocked',
        colorClass: 'danger',
      },
      {
        title: 'New Customers',
        value: `${newCustomers.length}`,
        detail: 'This Week',
        colorClass: 'info',
      },
    ];
  }

  private buildRecentOrders(orders: OrderResponse[]): void {
    this.recentOrders = [...orders]
      .sort((a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime())
      .slice(0, RECENT_ROWS)
      .map((o) => ({
        id: o.id,
        customer: o.username,
        total: o.totalAmount,
        status: o.status,
      }));
  }

  /** The products with the least stock first, so the ones that need restocking are at the top. */
  private buildStockItems(products: any[]): void {
    this.stockItems = [...products]
      .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0))
      .slice(0, RECENT_ROWS)
      .map((p) => ({
        name: p.productName,
        stock: p.stockQuantity ?? 0,
        unit: p.stockUnit ?? '',
        threshold: LOW_STOCK_THRESHOLD,
      }));
  }
}