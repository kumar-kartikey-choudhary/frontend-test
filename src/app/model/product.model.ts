/**
 * Mirrors the backend product-service DTOs (pratik-dairy-product / dto/*.java).
 *
 * `id` is a String UUID on the backend (BaseDto.id), not a number.
 */

export interface ProductImage {
  id: string;
  imageName?: string;
  imageType?: string;
  /**
   * Only populated when fetching a single product (GET /products/product/{id}).
   * On list/search responses this is omitted - render list thumbnails with
   * `GET /products/images/{id}` instead of expecting bytes inline.
   */
  imageData?: string; // base64 string as returned by Jackson for byte[]
  sortOrder: number;
  primary: boolean;
}

export interface Product {
  id: string;
  productName: string;
  price: number;
  available: boolean;
  /**
   * Stock, expressed in `stockUnit`-multiples (e.g. if stockUnit = "kg" and
   * stockQuantity = 10.5, there is 10.5kg in stock). Backend stores this as a
   * decimal (BigDecimal), so always treat it as a decimal on the frontend too
   * (don't round/parseInt it). Only ever changes via the dedicated stock
   * endpoints (decrement/restore/adjust) - editing this field and re-saving
   * the product does not move stock, see ProductService.adjustStock().
   */
  stockQuantity: number;
  stockUnit: string;
  // Backend enum: Dairy | Sweets | Bakery | Snacks | Cold_Drinks
  category: string;
  type?: string; // backend field name for sweet type is `type`, not `sweetType`
  description: string;
  manufactureDate: string;
  expiryDate: string;
  status: string;
  images: ProductImage[];
}

/** Client-only view model used by admin product cards - computed from `Product`, not sent to the backend. */
export type ProductStockStatus = 'In Stock' | 'Low Stock' | 'Discontinued';

export type InventoryReason = 'RESTOCK' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'SPOILAGE';

export interface InventoryLedgerEntry {
  id: string;
  productId: string;
  changeQty: number;
  reason: InventoryReason;
  referenceId?: string;
  createdAt: string;
}