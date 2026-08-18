import type { SafeUrl } from '@angular/platform-browser';

/** Mirrors backend CartItemDto (pratik-dairy-cart / CartItemDto.java). */
export interface CartItemDto {
  id: string;
  username: string;
  productId: string;
  productName: string;
  productImageUrl: string | SafeUrl;
  unit: string;
  weight: string;
  quantity: number;
  /** Already weight-adjusted by the backend (WeightPricing.priceFor) — do NOT re-apply a weight multiplier to this on the client. */
  pricePerUnit: number;
  /** = pricePerUnit * quantity, computed by the backend. */
  subtotal: number;
}

/**
 * Mirrors backend AddToCart DTO (pratik-dairy-cart / AddToCart.java) exactly:
 * { productId, quantity, weight }. No `totalAmount` field — the backend never
 * trusts a client-supplied price/total, it always recalculates it server-side
 * from the product's own price + weight, so sending one here would just be
 * silently ignored by Jackson at best, or a stale/misleading value at worst.
 */
export interface AddToCart {
  productId: string;
  quantity: number;
  weight: string;
}