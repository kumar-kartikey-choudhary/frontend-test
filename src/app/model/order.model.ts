/** Mirrors backend OrderStatus enum (pratik-dairy-order / OrderStatus.java). */
export type OrderStatus = 'PROCESSING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

/** Mirrors backend DiscountType enum (pratik-dairy-order / enums/DiscountType.java). */
export type DiscountType = 'PERCENT' | 'FLAT';

/** Mirrors backend DeliveryAddressDto (pratik-dairy-order / dto/DeliveryAddressDto.java). */
export interface DeliveryAddress {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  contactPhone?: string;
}

/** Customer-facing wording for each order status. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PROCESSING: 'Processing',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Mirrors backend OrderItemDto (pratik-dairy-order / dto/OrderItemDto.java). */
export interface OrderItemDto {
  id: string;
  productId: string;
  productName?: string; // only populated by findAll()/findByCustomerName()
  /** Id of the product's primary image - only populated by findAll()/findByCustomerName(). Build a URL with ProductService.imageUrl(id), not raw bytes. */
  productImageId?: string;
  /** Package count at `weight` (e.g. 3 packs of "250g"), not a stock-unit amount. */
  quantity: number;
  price: number;
  subTotal: number;
  /** Pack size bought, e.g. "250g", "500g", "1kg". */
  weight?: string;
}

/** Mirrors backend OrderStatusHistoryDto (pratik-dairy-order / dto/OrderStatusHistoryDto.java). */
export interface OrderStatusHistoryDto {
  id: string;
  status: OrderStatus;
  remarks?: string;
  changedBy?: string;
  createdAt: string; // when this transition happened
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
  /** How many times ONE customer may use the code (cancelled orders don't count). */
  usageLimitPerUser?: number;
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
  /** Where the order is to be delivered. Absent on orders placed before addresses were collected. */
  deliveryAddress?: DeliveryAddress | null;
}