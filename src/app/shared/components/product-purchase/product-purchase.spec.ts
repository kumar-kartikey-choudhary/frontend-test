import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from '../../../service/login/auth-service';
import { CartService } from '../../../service/cart/CartService';
import { provideAppTesting } from '../../../../testing';
import type { Product } from '../../../model';
import { ProductPurchase } from './product-purchase';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  productName: 'Kaju Katli',
  price: 400,
  available: true,
  stockQuantity: 10,
  stockUnit: 'kg',
  category: 'Sweets',
  description: '',
  manufactureDate: '',
  expiryDate: '',
  status: 'In Stock',
  images: [],
  ...overrides,
});

describe('ProductPurchase', () => {
  let fixture: ComponentFixture<ProductPurchase>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(p: Product): void {
    fixture = TestBed.createComponent(ProductPurchase);
    fixture.componentRef.setInput('product', p);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [ProductPurchase], providers: provideAppTesting() }));

  it('offers pack sizes for weight-sold products and updates the price when one is picked', () => {
    render(product());
    const pills = el().querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(Array.from(pills).map((b) => b.textContent!.trim())).toEqual(['250g', '500g', '1kg']);
    expect(el().querySelector('.price')!.textContent).toContain('₹400');

    pills[1].click(); // 500g
    fixture.detectChanges();
    expect(el().querySelector('.price')!.textContent).toContain('₹200');
    expect(pills[1].getAttribute('aria-checked')).toBe('true');
  });

  it('hides pack sizes for counted units and shows the unit instead', () => {
    render(product({ stockUnit: 'pcs', price: 40 }));
    expect(el().querySelector('[role="radiogroup"]')).toBeNull();
    expect(el().querySelector('.price')!.textContent).toContain('₹40');
    expect(el().querySelector('.price')!.textContent).toContain('pcs');
  });

  it('shows a disabled "Out of stock" button instead of add-to-cart', () => {
    render(product({ stockQuantity: 0 }));
    const button = el().querySelector<HTMLButtonElement>('.btn')!;
    expect(button.textContent).toContain('Out of stock');
    expect(button.disabled).toBeTrue();
    expect(el().querySelector('.btn--add')).toBeNull();
  });

  describe('the same product at different pack sizes', () => {
    let http: HttpTestingController;

    /** Put `quantity` packs of `weight` into the cart, as the server would confirm it. */
    function inCart(weight: string, quantity: number): void {
      TestBed.inject(CartService).addToCart('p1', weight, quantity);
      http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight, quantity });
    }

    beforeEach(() => {
      spyOn(TestBed.inject(AuthService), 'isLoggedIn').and.returnValue(true);
      http = TestBed.inject(HttpTestingController);
    });

    it('shows "Add to cart" for a pack size that is not in the cart yet, even if another size is', () => {
      inCart('250g', 2);
      render(product());
      const pills = el().querySelectorAll<HTMLButtonElement>('[role="radio"]');

      pills[0].click(); // 250g - already in the cart
      fixture.detectChanges();
      expect(el().querySelector('.stepper .qty')!.textContent).toContain('2');

      pills[2].click(); // 1kg - a new line
      fixture.detectChanges();
      expect(el().querySelector('.stepper')).toBeNull();
      expect(el().querySelector('.btn--add')).not.toBeNull();
    });

    it('adds a second pack size as its own line without touching the first', () => {
      inCart('250g', 2);
      render(product());
      const pills = el().querySelectorAll<HTMLButtonElement>('[role="radio"]');
      pills[2].click(); // 1kg
      fixture.detectChanges();

      el().querySelector<HTMLButtonElement>('.btn--add')!.click();
      const req = http.expectOne((r) => r.method === 'POST');
      expect(req.request.body).toEqual({ productId: 'p1', quantity: 1, weight: '1kg' });
      req.flush({ productId: 'p1', weight: '1kg', quantity: 1 });
      fixture.detectChanges();

      const cart = TestBed.inject(CartService);
      expect(cart.getQuantity('p1', '250g')).toBe(2);
      expect(cart.getQuantity('p1', '1kg')).toBe(1);
      expect(el().querySelector('.in-cart')!.textContent).toContain('250g × 2');
      expect(el().querySelector('.in-cart')!.textContent).toContain('1kg × 1');
    });
  });
});
