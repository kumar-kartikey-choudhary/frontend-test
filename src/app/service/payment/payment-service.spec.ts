import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { PaymentService } from './payment-service';

import { provideAppTesting } from '../../../testing';

/** Stands in for Razorpay's checkout.js: records how it was opened and "pays" as soon as it opens. */
class FakeRazorpay {
  static opened: Record<string, unknown>[] = [];
  constructor(private readonly options: Record<string, any>) {
    FakeRazorpay.opened.push(options);
  }
  on(): void {}
  open(): void {
    this.options['handler']({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' });
  }
}

describe('PaymentService', () => {
  let service: PaymentService;
  let http: HttpTestingController;
  const tick = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    FakeRazorpay.opened = [];
    (window as any).Razorpay = FakeRazorpay;
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    delete (window as any).Razorpay;
    http.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /** Runs a whole payment, answering initiate (with the given gateway customer) and verify. */
  async function pay(method: 'UPI' | 'CARD' | 'COD', options: Record<string, unknown>, customer: string | null) {
    const result = service.payForOrder('o1', 450, method, { customerName: 'asha', ...options });
    const initiate = http.expectOne((r) => r.url.endsWith('/payments/initiate'));
    initiate.flush({ paymentTransactionId: 't1', gatewayOrderId: 'order_1', keyId: 'rzp_test', amount: 450, currency: 'INR', gatewayCustomerId: customer });
    await tick();
    const verify = http.expectOne((r) => r.url.endsWith('/payments/verify'));
    verify.flush({ id: 't1', status: 'SUCCESS' });
    await result;
    return { initiate: initiate.request.body, verify: verify.request.body };
  }

  it('a new card the customer wants saved: asks for a customer, opens Checkout under it, and tells verify to keep the card', async () => {
    const { initiate, verify } = await pay('CARD', { saveCard: true }, 'cust_1');

    expect(initiate).toEqual({ orderId: 'o1', amount: 450, method: 'CARD', saveCard: true, savedPaymentMethodId: undefined });
    expect(FakeRazorpay.opened[0]['customer_id']).toBe('cust_1');
    expect(FakeRazorpay.opened[0]['remember_customer']).toBe(true);
    expect(verify.saveCard).toBeTrue();
  });

  it('a saved card: names it, opens Checkout under its customer, and does not save anything new', async () => {
    const { initiate, verify } = await pay('CARD', { savedPaymentMethodId: 'm1', saveCard: true }, 'cust_1');

    expect(initiate.savedPaymentMethodId).toBe('m1');
    expect(initiate.saveCard).toBeFalse();
    expect(FakeRazorpay.opened[0]['customer_id']).toBe('cust_1');
    expect(FakeRazorpay.opened[0]['remember_customer']).toBe(false);
    expect(verify.saveCard).toBeFalse();
  });

  it('a card payment with nothing to save involves no customer at all', async () => {
    const { initiate } = await pay('CARD', {}, null);

    expect(initiate.saveCard).toBeFalse();
    expect('customer_id' in FakeRazorpay.opened[0]).toBeFalse();
  });

  it('card choices are ignored for UPI', async () => {
    const { initiate, verify } = await pay('UPI', { saveCard: true, savedPaymentMethodId: 'm1' }, null);

    expect(initiate.saveCard).toBeFalse();
    expect(initiate.savedPaymentMethodId).toBeUndefined();
    expect(verify.saveCard).toBeFalse();
  });

  it('cash on delivery needs no Checkout at all', async () => {
    const result = service.payForOrder('o1', 450, 'COD', { customerName: 'asha' });
    http.expectOne((r) => r.url.endsWith('/payments/initiate'))
      .flush({ paymentTransactionId: 't1', gatewayOrderId: null, keyId: null, amount: 450, currency: 'INR' });
    expect(await result).toBeNull();
    expect(FakeRazorpay.opened.length).toBe(0);
  });
});
