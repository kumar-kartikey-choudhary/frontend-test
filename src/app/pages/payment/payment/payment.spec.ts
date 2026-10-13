import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Payment } from './payment';

import { provideAppTesting } from '../../../../testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { CartService } from '../../../service/cart/CartService';
import { PaymentService } from '../../../service/payment/payment-service';
describe('Payment', () => {
  let component: Payment;
  let fixture: ComponentFixture<Payment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [Payment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Payment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('paying by card', () => {
    let http: HttpTestingController;
    const el = () => fixture.nativeElement as HTMLElement;

    const cards = [
      { id: 'm1', cardLastFour: '4242', cardNetwork: 'VISA', cardExpiryMonth: 12, cardExpiryYear: 2030, isDefault: false },
      { id: 'm2', cardLastFour: '1111', cardNetwork: 'MASTERCARD', cardExpiryMonth: 1, cardExpiryYear: 2031, isDefault: true },
    ];

    /** Answers every request the checkout page makes while loading. */
    function loadCheckout(savedCards: any[]): void {
      const answers: Record<string, any> = {
        '/carts': [{ id: 'l1', productId: 'p1', productName: 'Paneer', quantity: 1, weight: '1kg', unit: 'kg', pricePerUnit: 300, subtotal: 300 }],
        '/users/addresses': [{ id: 'a1', label: 'Home', line1: '1 Main St', city: 'Waraseoni', state: 'MP', pincode: '481331', default: true }],
        '/users/me': { id: 'u1', phoneNumber: '9876543210' },
        '/payments/saved-methods': savedCards,
      };
      for (const request of http.match(() => true)) {
        const key = Object.keys(answers).find((suffix) => request.request.url.endsWith(suffix));
        request.flush(key ? answers[key] : []);
      }
      fixture.detectChanges();
    }

    function chooseCard(): void {
      const radio = el().querySelector<HTMLInputElement>('input[name=paymentMethod][value=CARD]')!;
      radio.click();
      radio.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    beforeEach(() => {
      http = TestBed.inject(HttpTestingController);
    });

    it('lists the saved cards with the default one chosen, plus "use a different card"', () => {
      loadCheckout(cards);
      chooseCard();

      const options = Array.from(el().querySelectorAll('.saved-card')).map((l) => l.textContent!.trim());
      expect(options.length).toBe(3);
      expect(options[0]).toContain('Visa ending 4242');
      expect(options[1]).toContain('Mastercard ending 1111');
      expect(options[2]).toContain('different card');
      expect((el().querySelectorAll('.saved-card input')[1] as HTMLInputElement).checked).toBeTrue();   // the default
      expect(el().querySelector('.save-card-option')).toBeNull();   // nothing to save when a saved card is chosen
    });

    it('offers to save a new card only when a different card is chosen', () => {
      loadCheckout(cards);
      chooseCard();
      (el().querySelectorAll('.saved-card input')[2] as HTMLInputElement).click();
      (el().querySelectorAll('.saved-card input')[2] as HTMLInputElement).dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(el().querySelector('.save-card-option')).not.toBeNull();
    });

    it('with no saved cards it just offers to save the new one', () => {
      loadCheckout([]);
      chooseCard();

      expect(el().querySelector('.saved-cards')).toBeNull();
      expect(el().querySelector('.save-card-option')).not.toBeNull();
    });

    it('pays with the chosen saved card', async () => {
      loadCheckout(cards);
      chooseCard();
      const cart = TestBed.inject(CartService);
      const payments = TestBed.inject(PaymentService);
      spyOn(cart, 'placeOrder').and.returnValue(of({ id: 'o1', username: 'asha', totalAmount: 300 } as any));
      const payForOrder = spyOn(payments, 'payForOrder').and.resolveTo(null);
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);   // the page goes to My Orders afterwards

      (el().querySelector('.place-order-btn') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(payForOrder).toHaveBeenCalledWith('o1', 300, 'CARD', jasmine.objectContaining({ savedPaymentMethodId: 'm2' }));
    });
  });
});
