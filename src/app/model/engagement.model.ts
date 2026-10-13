/** Mirrors backend ReviewDto (pratik-dairy-product). */
export interface ReviewDto {
  id: string;
  productId: string;
  /** Partly hidden username, e.g. "ra***". */
  authorName: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  /** True for the signed-in customer's own review. */
  mine: boolean;
}

/** Mirrors backend ProductReviewsDto. */
export interface ProductReviews {
  average: number;
  count: number;
  reviews: ReviewDto[];
}

/** Mirrors backend RatingSummaryDto - the stars shown on catalogue cards. */
export interface RatingSummary {
  productId: string;
  average: number;
  count: number;
}

/** Mirrors backend ContactMessageDto. */
export interface ContactMessageDto {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  handled: boolean;
  createdAt: string;
}

export interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

/** Mirrors backend AdminNotificationRequest. */
export interface AdminNotificationRequest {
  audience: 'USER' | 'ALL_CUSTOMERS';
  username?: string;
  type: 'PROMOTION' | 'SYSTEM' | 'ORDER_UPDATE' | 'PAYMENT_UPDATE' | 'DELIVERY_REMINDER';
  title: string;
  message?: string;
}
