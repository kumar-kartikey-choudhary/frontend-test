import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../service/login/auth-service';

interface AdminLink {
  label: string;
  link: string;
  /** SVG path data (24x24, stroked) */
  icon: string;
}

@Component({
  selector: 'app-admin-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.css',
})
export class AdminHeader {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly navLinks: AdminLink[] = [
    { label: 'Dashboard', link: '/admin/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10' },
    {
      label: 'Products',
      link: '/admin/product',
      icon: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
    },
    {
      label: 'Orders',
      link: '/admin/orders',
      icon: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0',
    },
    {
      label: 'Payments',
      link: '/admin/payments',
      icon: 'M2 6h20v12H2V6zM2 10h20M6 15h4',
    },
    {
      label: 'Customers',
      link: '/admin/users',
      icon: 'M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
    },
    {
      label: 'Coupons',
      link: '/admin/coupons',
      icon: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8zM7 7h.01',
    },
    {
      label: 'Notifications',
      link: '/admin/notifications',
      icon: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    },
    {
      label: 'Messages',
      link: '/admin/messages',
      icon: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
    },
  ];

  readonly isMenuOpen = signal(false);

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  onLogOut(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
