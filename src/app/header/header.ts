import { Component, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../service/login/auth-service';
import { CartService } from '../service/cart/CartService';
import { NotificationService } from '../service/notification/notification-service';
import { WishlistService } from '../service/wishlist/wishlist-service';
import { StorageService } from '../core/services/storage.service';
import { environment } from '../../environments/environment';

/** How often the unread-notification badge re-checks the server while signed in. */
const NOTIFICATION_POLL_MS = 60_000;

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  readonly navLinks = [
    { label: 'Home', link: '/' },
    { label: 'Products', link: '/products' },
    { label: 'About Us', link: '/about' },
    { label: 'Contact', link: '/contact' },
  ];

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cart = inject(CartService);
  private readonly notifications = inject(NotificationService);
  private readonly wishlist = inject(WishlistService);
  private readonly storage = inject(StorageService);

  readonly phone = environment.supportPhone;
  readonly phoneHref = 'tel:' + environment.supportPhone.replace(/[^+\d]/g, '');

  readonly cartCount = this.cart.itemCount;
  readonly wishlistCount = this.wishlist.count;
  readonly unreadCount = toSignal(this.notifications.unreadCount$, { initialValue: 0 });
  readonly isMenuOpen = signal(false);

  constructor() {
    // Load the cart / notification counts as soon as someone is signed in (also after a page
    // refresh), and clear them when they sign out - from any path, including an expired session.
    effect(() => {
      const loggedIn = this.auth.loggedIn();
      untracked(() => {
        if (loggedIn) {
          this.cart.syncCartFromBackend();
          this.notifications.refreshUnreadCount();
        } else {
          this.cart.reset();
        }
      });
    });

    effect((onCleanup) => {
      if (!this.auth.loggedIn() || !this.storage.isBrowser) return;
      const timer = setInterval(() => this.notifications.refreshUnreadCount(), NOTIFICATION_POLL_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

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
