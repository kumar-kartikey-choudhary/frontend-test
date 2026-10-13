import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../service/login/auth-service';
import { WishlistService } from '../../../service/wishlist/wishlist-service';
import { ToastService } from '../../../core/services/toast.service';

/** A heart that saves a product to the wishlist or takes it off again. Signed-out visitors are sent to log in. */
@Component({
  selector: 'app-wishlist-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wishlist-button.html',
  styleUrl: './wishlist-button.css',
})
export class WishlistButton {
  readonly productId = input.required<string>();
  /** "card" floats over a product picture; "inline" sits next to a heading. */
  readonly variant = input<'card' | 'inline'>('card');

  private readonly wishlist = inject(WishlistService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly saved = computed(() => this.wishlist.isSaved(this.productId()));

  protected toggle(event: Event): void {
    // The heart can sit inside a link; clicking it must not open the product.
    event.preventDefault();
    event.stopPropagation();
    if (!this.auth.isLoggedIn()) {
      this.toast.info('Sign in to save items to your wishlist.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.wishlist.toggle(this.productId());
  }
}
