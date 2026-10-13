import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CartService } from '../../../service/cart/CartService';
import type { Product } from '../../../model';
import {
  SELECTABLE_WEIGHTS,
  defaultWeightFor,
  isWeightBased,
  priceForWeight,
} from '../../uti/weight-pricing.util';
import { isOutOfStock } from '../../uti/stock.util';

/**
 * Pack-size selector, live price and add-to-cart / quantity stepper for one product.
 * Shared by the product cards and the product detail page so cart behaviour stays identical.
 */
@Component({
  selector: 'app-product-purchase',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-purchase.html',
  styleUrl: './product-purchase.css',
})
export class ProductPurchase {
  readonly product = input.required<Product>();
  /** "detail" renders larger controls for the product page. */
  readonly size = input<'card' | 'detail'>('card');

  protected readonly cart = inject(CartService);

  protected readonly weights = SELECTABLE_WEIGHTS;
  private readonly picked = signal<string | null>(null);

  protected readonly weightBased = computed(() => isWeightBased(this.product().stockUnit));
  protected readonly weight = computed(
    () => this.picked() ?? defaultWeightFor(this.product().stockUnit),
  );
  protected readonly price = computed(() =>
    priceForWeight(this.product().price, this.weight(), this.product().stockUnit),
  );
  /** "500g" for weight-sold products, otherwise the product's own unit ("pcs", "litre" ...). */
  protected readonly unitLabel = computed(() =>
    this.weightBased() ? this.weight() : this.product().stockUnit,
  );
  protected readonly soldOut = computed(() => isOutOfStock(this.product()));
  /** Packs of the pack size currently picked that are in the cart (each pack size is its own line). */
  protected readonly qty = computed(() => this.cart.getQuantity(this.product().id, this.weight()));
  protected readonly busy = computed(() => this.cart.isLoading(this.product().id, this.weight()));
  /** Every pack size of this product in the cart, e.g. "250g x 2, 1kg x 1" - shown under the controls. */
  protected readonly inCart = computed(() => this.cart.linesOf(this.product().id));

  protected pick(weight: string): void {
    // Only changes which pack size the controls act on; pack sizes already in the cart are left alone.
    this.picked.set(weight);
  }

  protected add(): void {
    this.cart.addToCart(this.product().id, this.weight());
  }
}
