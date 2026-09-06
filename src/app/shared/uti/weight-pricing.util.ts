/**
 * Mirrors backend WeightPricing (pratik-dairy-cart / cart-service /
 * com/pratikdairy/cart/util/WeightPricing.java).
 *
 * The backend is the source of truth for the price actually charged - this
 * copy exists purely so product cards can show the correct price *before*
 * the item is added to the cart, for whichever weight the user has picked.
 */

/** Must stay in sync with WeightPricing.SELECTABLE_WEIGHTS on the backend. */
export const SELECTABLE_WEIGHTS: readonly string[] = ['250g', '500g', '1kg'];

export function toGrams(unit: string | null | undefined): number {
  if (!unit || !unit.trim()) {
    return 1000; // Default to 1kg if blank
  }

  const u = unit.trim().toLowerCase().replace(/\s+/g, '');

  if (u === 'kg') return 1000;
  if (u === 'g' || u === 'gms') return 1;

  if (u.endsWith('kg')) {
    const n = parseFloat(u.slice(0, -2));
    return Number.isNaN(n) ? 1000 : n * 1000;
  }
  if (u.endsWith('gms')) {
    const n = parseFloat(u.slice(0, -3));
    return Number.isNaN(n) ? 1000 : n;
  }
  if (u.endsWith('g')) {
    const n = parseFloat(u.slice(0, -1));
    return Number.isNaN(n) ? 1000 : n;
  }
  return 1000;
}

export function multiplierFor(selectedWeight: string, productBaseUnit: string | null | undefined): number {
  const selectedGrams = toGrams(selectedWeight);
  const baseGrams = productBaseUnit && productBaseUnit.trim() ? toGrams(productBaseUnit) : 1000;

  if (selectedGrams <= 0 || baseGrams <= 0) return 1;
  return selectedGrams / baseGrams;
}

/** basePrice is the product's price for one unit of its own stockUnit (productBaseUnit). */
export function priceForWeight(
  basePrice: number,
  selectedWeight: string,
  productBaseUnit: string | null | undefined,
): number {
  if (basePrice == null) return 0;
  const multiplier = multiplierFor(selectedWeight, productBaseUnit);
  return Math.round(basePrice * multiplier * 100) / 100;
}

/** Picks a sensible starting selection: the product's own unit if it's one of the
 * selectable weights, otherwise 1kg (same fallback the backend uses). */
export function defaultWeightFor(productBaseUnit: string | null | undefined): string {
  const normalized = productBaseUnit?.trim().toLowerCase();
  return normalized && (SELECTABLE_WEIGHTS as string[]).includes(normalized) ? normalized : '1kg';
}