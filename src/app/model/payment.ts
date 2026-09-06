/** Mirrors backend payment-service enums (pratik-dairy-payment / enums/*.java). */
export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'COD';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type CardNetwork = 'VISA' | 'MASTERCARD' | 'RUPAY' | 'AMEX' | 'OTHER';

/** Mirrors backend InitiatePaymentRequest. */
export interface InitiatePaymentRequest {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  savedPaymentMethodId?: string;
}

/** Mirrors backend InitiatePaymentResponse - gatewayOrderId/keyId are null for COD (no gateway step). */
export interface InitiatePaymentResponse {
  paymentTransactionId: string;
  gatewayOrderId: string | null;
  keyId: string | null;
  amount: number;
  currency: string;
}

/** Mirrors backend VerifyPaymentRequest - the fields Razorpay Checkout hands back on success. */
export interface VerifyPaymentRequest {
  paymentTransactionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  saveCard: boolean;
}

/** Mirrors backend PaymentTransactionDto. */
export interface PaymentTransactionDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayPaymentId?: string;
  upiVpa?: string;
  failureReason?: string;
  paidAt?: string;
  createdAt: string;
}

/** Mirrors backend SavedPaymentMethodDto - never carries the gateway token, only display fields. */
export interface SavedPaymentMethodDto {
  id: string;
  cardLastFour: string;
  cardNetwork: CardNetwork;
  cardExpiryMonth: number;
  cardExpiryYear: number;
  isDefault: boolean;
}

/** Shape Razorpay's checkout.js hands to the success handler - see PaymentService.openCheckout(). */
export interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}