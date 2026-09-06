import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  PaymentMethod,
  PaymentTransactionDto,
  RazorpayCheckoutResponse,
  SavedPaymentMethodDto,
  VerifyPaymentRequest,
} from '../../model/payment';

declare var Razorpay: any;

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly apiUrl = `${environment.apiBaseUrl}/payments`;
  private scriptLoadPromise: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  // ---------- Raw API calls ----------

  initiate(request: InitiatePaymentRequest): Observable<InitiatePaymentResponse> {
    return this.http.post<InitiatePaymentResponse>(`${this.apiUrl}/initiate`, request);
  }

  verify(request: VerifyPaymentRequest): Observable<PaymentTransactionDto> {
    return this.http.post<PaymentTransactionDto>(`${this.apiUrl}/verify`, request);
  }

  findByOrder(orderId: string): Observable<PaymentTransactionDto[]> {
    return this.http.get<PaymentTransactionDto[]>(`${this.apiUrl}/order/${orderId}`);
  }

  getSavedMethods(): Observable<SavedPaymentMethodDto[]> {
    return this.http.get<SavedPaymentMethodDto[]>(`${this.apiUrl}/saved-methods`);
  }

  deleteSavedMethod(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/saved-methods/${id}`);
  }

  // ---------- Razorpay Checkout.js loader ----------

  /** Injects the Razorpay Checkout script once and caches the loading promise. */
  private loadRazorpayScript(): Promise<void> {
    if (this.scriptLoadPromise) return this.scriptLoadPromise;

    this.scriptLoadPromise = new Promise((resolve, reject) => {
      if (typeof Razorpay !== 'undefined') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay Checkout script'));
      document.body.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  /**
   * Opens the Razorpay Checkout modal and resolves with the result once the customer
   * completes payment, or rejects if they close the modal without paying.
   */
  private openCheckout(
    init: InitiatePaymentResponse,
    options: { name: string; description: string; email?: string; contact?: string; prefillToken?: string },
  ): Promise<RazorpayCheckoutResponse> {
    return new Promise((resolve, reject) => {
      const rzp = new Razorpay({
        key: init.keyId,
        amount: Math.round(init.amount * 100), // paise
        currency: init.currency,
        order_id: init.gatewayOrderId,
        name: options.name,
        description: options.description,
        prefill: {
          email: options.email,
          contact: options.contact,
        },
        // Requests Razorpay to tokenize the card against a customer id, so a later "save card"
        // choice actually has a token to pull - see RazorpayGatewayClient.tokenizeCard() on the
        // backend, which reads this back via the customer's token list.
        recurring: '0',
        handler: (response: RazorpayCheckoutResponse) => resolve(response),
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled')),
        },
      });
      rzp.on('payment.failed', (resp: any) => {
        reject(new Error(resp?.error?.description || 'Payment failed'));
      });
      rzp.open();
    });
  }

  // ---------- Full checkout orchestration ----------

  /**
   * Runs the complete pay-for-an-order flow: initiate -> (COD: done) -> open Checkout ->
   * verify. Throws with a user-facing message on any failure/cancellation.
   */
  async payForOrder(
    orderId: string,
    amount: number,
    method: PaymentMethod,
    options: { customerName: string; email?: string; contact?: string; saveCard?: boolean } = {
      customerName: 'Pratik Dairy Customer',
    },
  ): Promise<PaymentTransactionDto | null> {
    const initResponse = await firstValueFrom(this.initiate({ orderId, amount, method }));

    // COD needs no gateway step - the transaction is already recorded PENDING on the backend.
    if (method === 'COD' || !initResponse.gatewayOrderId) {
      return null;
    }

    await this.loadRazorpayScript();

    const checkoutResult = await this.openCheckout(initResponse, {
      name: 'Pratik Dairy & Sweets',
      description: `Order #${orderId}`,
      email: options.email,
      contact: options.contact,
    });

    return firstValueFrom(
      this.verify({
        paymentTransactionId: initResponse.paymentTransactionId,
        razorpayOrderId: checkoutResult.razorpay_order_id,
        razorpayPaymentId: checkoutResult.razorpay_payment_id,
        razorpaySignature: checkoutResult.razorpay_signature,
        saveCard: method === 'CARD' && !!options.saveCard,
      }),
    );
  }
}