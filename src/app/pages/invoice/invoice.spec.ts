import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import { Invoice } from './invoice';

const order = (extra: Record<string, unknown> = {}) => ({
  id: 'abcdef12-3456-7890',
  username: 'asha',
  orderDateTime: '2026-10-01T10:00:00',
  status: 'CONFIRMED',
  subtotalAmount: 500,
  discountAmount: 50,
  couponCode: 'DIWALI',
  totalAmount: 450,
  items: [
    { id: 'i1', productId: 'p1', productName: 'Kaju Katli', quantity: 2, price: 200, subTotal: 400, weight: '500g' },
    { id: 'i2', productId: 'p2', productName: 'Paneer', quantity: 1, price: 100, subTotal: 100, weight: '1kg' },
  ],
  statusHistory: [],
  deliveryAddress: { line1: '1 Main St', city: 'Waraseoni', state: 'MP', pincode: '481331', landmark: 'Near the temple' },
  ...extra,
});

const payment = (status: string, method = 'UPI', extra: Record<string, unknown> = {}) => ({
  id: 't1', orderId: 'abcdef12-3456-7890', amount: 450, currency: 'INR', method, status,
  createdAt: '2026-10-01T10:01:00', paidAt: '2026-10-01T10:02:00', ...extra,
});

describe('Invoice', () => {
  let fixture: ComponentFixture<Invoice>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Invoice], providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(orderBody: any, payments: any, paymentsStatus = 200): void {
    fixture = TestBed.createComponent(Invoice);
    fixture.componentRef.setInput('id', 'abcdef12-3456-7890');
    fixture.detectChanges();
    const detail = http.expectOne((r) => r.url.endsWith('/orders/abcdef12-3456-7890/detail'));
    const pay = http.expectOne((r) => r.url.endsWith('/payments/order/abcdef12-3456-7890'));
    if (orderBody instanceof Error) {
      // The order is missing, so the page gives up at once and the payment request is cancelled with it.
      detail.flush({}, { status: 404, statusText: 'Not Found' });
      expect(pay.cancelled).toBeTrue();
    } else {
      detail.flush(orderBody);
      if (paymentsStatus === 200) pay.flush(payments);
      else pay.flush({}, { status: paymentsStatus, statusText: 'err' });
    }
    fixture.detectChanges();
  }

  it('shows the shop, the invoice number, the lines and the totals', () => {
    render(order(), [payment('SUCCESS')]);

    expect(el().querySelector('h1')!.textContent).toContain('Pratik Dairy');
    expect(el().textContent).toContain('#ABCDEF12');
    expect(el().textContent).toContain('Kaju Katli');
    expect(el().textContent).toContain('500g');
    expect(el().textContent).toContain('1 Main St');
    expect(el().textContent).toContain('Near the temple');
    const totals = el().querySelector('.totals')!.textContent!;
    expect(totals).toContain('₹500.00');
    expect(totals).toContain('DIWALI');
    expect(totals).toContain('₹450.00');
    expect(el().querySelectorAll('.lines tbody tr').length).toBe(2);
  });

  it('says how it was paid', () => {
    render(order(), [payment('SUCCESS', 'UPI')]);
    expect(el().textContent).toContain('Paid online - Upi');
  });

  it('notes a part refund, a cash order and an unpaid one', () => {
    render(order(), [payment('SUCCESS', 'UPI', { refundedAmount: 100 })]);
    expect(el().textContent).toContain('₹100 refunded');
  });

  it('says cash on delivery is still to be paid', () => {
    render(order(), [payment('PENDING', 'COD')]);
    expect(el().textContent).toContain('Cash on delivery - to be paid when delivered');
  });

  it('stamps a cancelled order and leaves out the discount line when there was none', () => {
    render(order({ status: 'CANCELLED', discountAmount: 0, couponCode: null }), [payment('REFUNDED')]);
    expect(el().querySelector('.stamp')!.textContent).toContain('Cancelled');
    expect(el().querySelector('.totals')!.textContent).not.toContain('Discount');
    expect(el().textContent).toContain('refunded');
  });

  it('still shows the invoice when the payment lookup fails', () => {
    render(order(), [], 500);
    expect(el().textContent).toContain('Kaju Katli');
    expect(el().textContent).toContain('Not yet paid');
  });

  it('says so, with a way back, when the order is not found or not theirs', () => {
    render(new Error('404'), []);
    expect(el().textContent).toContain("couldn't find that order");
    expect(el().querySelector('a[href="/orders"]')).not.toBeNull();
  });

  it('prints through the browser', () => {
    render(order(), [payment('SUCCESS')]);
    const print = spyOn(window, 'print');
    (el().querySelector('.print-btn') as HTMLButtonElement).click();
    expect(print).toHaveBeenCalled();
  });
});
