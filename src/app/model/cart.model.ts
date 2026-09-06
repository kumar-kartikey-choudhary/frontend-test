/** Mirrors backend CartItemDto (pratik-dairy-cart / dto/CartItemDto.java). */
export interface CartItemDto {
  id?: string;
  username?: string;
  productId: string;
  productName: string;
  /** Id of the product's primary image - build a URL with ProductService.imageUrl(id), not raw bytes. */
  productImageId?: string;
  /** The product's own stockUnit (e.g. "kg", "pcs") - display only, e.g. "2.5 kg". */
  unit: string;
  weight: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
}

/** Mirrors backend AddToCart (pratik-dairy-cart / dto/AddToCart.java). */
export interface AddToCart {
  productId: string;
  quantity: number;
   weight: string;
}