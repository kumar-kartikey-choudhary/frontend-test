/** Mirrors backend OrderStatus enum (pratik-dairy-order / OrderStatus.java). */
export type OrderStatus = 'PROCESSING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

/** Mirrors backend PaymentMethod enum (pratik-dairy-order / enums/PaymentMethod.java). */
export type PaymentMethod = 'COD' | 'UPI' | 'CARD' | 'WALLET';

/** Mirrors backend PaymentStatus enum (pratik-dairy-order / enums/PaymentStatus.java). */
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

/** Mirrors backend DiscountType enum (pratik-dairy-order / enums/DiscountType.java). */
export type DiscountType = 'PERCENT' | 'FLAT';

/** Mirrors backend OrderItemDto (pratik-dairy-order / dto/OrderItemDto.java). */
export interface OrderItemDto {
  id: string;
  productId: string;
  productName?: string; // only populated by findAll()/findByCustomerName()
  /** Id of the product's primary image - only populated by findAll()/findByCustomerName(). Build a URL with ProductService.imageUrl(id), not raw bytes. */
  productImageId?: string;
  quantity: number;
  price: number;
  subTotal: number;
}

/** Mirrors backend OrderStatusHistoryDto (pratik-dairy-order / dto/OrderStatusHistoryDto.java). */
export interface OrderStatusHistoryDto {
  id: string;
  status: OrderStatus;
  remarks?: string;
  changedBy?: string;
  createdAt: string; // when this transition happened
}

/** Mirrors backend PaymentDto (pratik-dairy-order / dto/PaymentDto.java). */
export interface PaymentDto {
  id: string;
  orderId: string;
  method: PaymentMethod;
  transactionId?: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
  createdAt: string;
}

/** Mirrors backend CouponDto (pratik-dairy-order / dto/CouponDto.java). */
export interface CouponDto {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number;
  validFrom?: string;
  validTo?: string;
  usageLimit?: number;
  usedCount: number;
  active: boolean;
}

/** Mirrors backend OrderResponse (pratik-dairy-order / dto/OrderResponse.java). */
export interface OrderResponse {
  id: string;
  username: string;
  orderDateTime: string; // ISO string over the wire; DatePipe parses it fine
  status: OrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  /** Code of the coupon applied at checkout, if any - null otherwise. */
  couponCode?: string | null;
  totalAmount: number;
  items: OrderItemDto[];
  /** Only populated by findAll()/findByCustomerName() - empty on the response returned from create()/updateStatus(). */
  statusHistory: OrderStatusHistoryDto[];
  /** Only populated by findAll()/findByCustomerName() - empty on the response returned from create()/updateStatus(). */
  payments: PaymentDto[];
}