import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import { MyOrders } from './my-orders';

const order = (id: string, status = 'CONFIRMED') => ({
  id,
  username: 'a',
  orderDateTime: '2026-10-01T10:00:00',
  status,
  subtotalAmount: 100,
  discountAmount: 0,
  totalAmount: 100,
  items: [{ id: 'i-' + id, productId: 'p', productName: 'Paneer', quantity: 2, price: 50, subTotal: 100, weight: '500g' }],
  statusHistory: [],
});

const payment = (orderId: string, method: string, status: string) => ({
  id: 'tx-' + orderId, orderId, amount: 100, currency: 'INR', method, status, createdAt: '2026-10-01T10:01:00',
});

describe('MyOrders', () => {
  let fixture: ComponentFixture<MyOrders>;
  let http: HttpTestingController;
  const text = (card: number) =>
    (fixture.nativeElement.querySelectorAll('.order-card')[card] as HTMLElement).textContent!;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MyOrders], providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyOrders);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function load(orders: unknown[], payments: Record<string, unknown[]>): void {
    http.expectOne((r) => r.url.endsWith('/orders/findByCustomer')).flush(orders);
    for (const id of Object.keys(payments)) {
      http.expectOne((r) => r.url.endsWith(`/payments/order/${id}`)).flush(payments[id]);
    }
    fixture.detectChanges();
  }

  it('lets a cash-on-delivery order be cancelled but not re-paid', () => {
    load([order('aaaaaaaa1')], { aaaaaaaa1: [payment('aaaaaaaa1', 'COD', 'PENDING')] });
    expect(text(0)).toContain('Cancel order');
    expect(text(0)).toContain('Pay cash on delivery');
    expect(text(0)).not.toContain('Pay now');
  });

  it('offers "Pay now" for a failed online payment', () => {
    load([order('bbbbbbbb1')], { bbbbbbbb1: [payment('bbbbbbbb1', 'UPI', 'FAILED')] });
    expect(text(0)).toContain('Payment failed');
    expect(text(0)).toContain('Pay now');
    expect(text(0)).toContain('Pay on delivery instead');
  });

  it('lets an order that was paid online be cancelled, since it is refunded automatically', () => {
    load([order('cccccccc1')], { cccccccc1: [payment('cccccccc1', 'UPI', 'SUCCESS')] });
    expect(text(0)).toContain('Cancel order');
    expect(text(0)).toContain('Paid online');
    expect(text(0)).not.toContain('Contact us');
  });

  it('shows where the refund stands on a cancelled order', () => {
    load(
      [order('eeeeeeee1', 'CANCELLED'), order('ffffffff1', 'CANCELLED'), order('gggggggg1', 'CANCELLED')],
      {
        eeeeeeee1: [payment('eeeeeeee1', 'UPI', 'REFUNDED')],
        ffffffff1: [payment('ffffffff1', 'UPI', 'SUCCESS')], // automatic refund did not go through
        gggggggg1: [payment('gggggggg1', 'COD', 'FAILED')],
      },
    );
    expect(text(0)).toContain('Refunded');
    expect(text(1)).toContain('Refund pending');
    expect(text(2)).not.toContain('Refund');
    expect(text(0)).not.toContain('Cancel order'); // already cancelled
  });

  it('shows no actions once an order has shipped, and shows the pack size bought', () => {
    load([order('dddddddd1', 'SHIPPED')], { dddddddd1: [payment('dddddddd1', 'COD', 'PENDING')] });
    expect(text(0)).not.toContain('Cancel order');
    expect(text(0)).toContain('2 × 500g');
  });

  it('shows an error with retry instead of a misleading "no orders"', () => {
    http.expectOne((r) => r.url.endsWith('/orders/findByCustomer')).flush('x', { status: 500, statusText: 'err' });
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain("couldn't load your orders");
    expect(html.textContent).not.toContain('No orders found');
  });

  it('links every order to its invoice', () => {
    load([order('hhhhhhhh1')], { hhhhhhhh1: [payment('hhhhhhhh1', 'COD', 'PENDING')] });
    expect(fixture.nativeElement.querySelector('a.btn-invoice')!.getAttribute('href')).toBe('/orders/hhhhhhhh1/invoice');
  });

  it('says when an online payment has been partly refunded', () => {
    load([order('iiiiiiii1')], { iiiiiiii1: [{ ...payment('iiiiiiii1', 'UPI', 'SUCCESS'), refundedAmount: 40 }] });
    expect(text(0)).toContain('Partly refunded (₹40 of ₹100)');
  });
});
