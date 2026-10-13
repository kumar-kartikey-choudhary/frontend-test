import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ShoppingCart } from './shopping-cart';
import { ConfirmService } from '../../core/services/confirm.service';

import { provideAppTesting } from '../../../testing';

const line = (productId: string, name: string, quantity = 1, weight = '1kg') => ({
  id: 'l-' + productId,
  username: 'a',
  productId,
  productName: name,
  unit: 'kg',
  weight,
  quantity,
  pricePerUnit: 100,
  subtotal: 100 * quantity,
  stockToConsume: quantity,
});

describe('ShoppingCart', () => {
  let component: ShoppingCart;
  let fixture: ComponentFixture<ShoppingCart>;
  let http: HttpTestingController;
  let confirm: ConfirmService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [ShoppingCart],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    confirm = TestBed.inject(ConfirmService);
    fixture = TestBed.createComponent(ShoppingCart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const clearButton = () => fixture.nativeElement.querySelector('.btn-clear-cart') as HTMLButtonElement | null;

  function loadTwoItems(): void {
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/carts')).flush([line('p1', 'Paneer', 2), line('p2', 'Barfi')]);
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers "Clear cart" only when there is something in the cart', () => {
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/carts')).flush([]);
    fixture.detectChanges();
    expect(clearButton()).toBeNull();
  });

  it('empties the whole cart with one request once the customer confirms', async () => {
    loadTwoItems();
    spyOn(confirm, 'confirm').and.resolveTo(true);

    clearButton()!.click();
    await fixture.whenStable();
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/carts/clear')).flush(null);
    fixture.detectChanges();

    expect(confirm.confirm).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Clear your cart?' }));
    expect(fixture.nativeElement.querySelectorAll('.cart-item-card').length).toBe(0);
    expect(clearButton()).toBeNull();
  });

  it('keeps everything when the customer changes their mind', async () => {
    loadTwoItems();
    spyOn(confirm, 'confirm').and.resolveTo(false);

    clearButton()!.click();
    await fixture.whenStable();
    http.expectNone((r) => r.method === 'DELETE');

    expect(fixture.nativeElement.querySelectorAll('.cart-item-card').length).toBe(2);
  });

  it('keeps the items and lets them try again when the server fails', async () => {
    loadTwoItems();
    spyOn(confirm, 'confirm').and.resolveTo(true);

    clearButton()!.click();
    await fixture.whenStable();
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/carts/clear'))
      .flush({ message: 'boom' }, { status: 500, statusText: 'err' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.cart-item-card').length).toBe(2);
    expect(clearButton()!.disabled).toBeFalse();
  });

  describe('the same product at different pack sizes', () => {
    const names = () =>
      Array.from(fixture.nativeElement.querySelectorAll('.cart-item-card') as NodeListOf<HTMLElement>).map((card) =>
        card.querySelector('.product-name')!.textContent!.trim() + ' ' + card.querySelector('.unit-badge')!.textContent!.trim() + ' x' + card.querySelector('.qty-count')!.textContent!.trim(),
      );

    function loadSplitLines(): void {
      http
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/carts'))
        .flush([line('p1', 'Barfi', 2, '250g'), line('p1', 'Barfi', 1, '1kg')]);
      fixture.detectChanges();
    }

    it('lists each pack size as its own line with its own quantity', () => {
      loadSplitLines();
      expect(names()).toEqual(['Barfi 250g x2', 'Barfi 1kg x1']);
    });

    it('changes only the line whose button was pressed', () => {
      loadSplitLines();
      (fixture.nativeElement.querySelectorAll('[aria-label="Increase quantity"]')[1] as HTMLButtonElement).click();
      const req = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/carts/items/p1'));
      expect(req.request.params.get('weight')).toBe('1kg');
      expect(req.request.params.get('quantity')).toBe('2');
      req.flush({ subtotal: 200 });
      fixture.detectChanges();

      expect(names()).toEqual(['Barfi 250g x2', 'Barfi 1kg x2']);
    });

    it('removes only that pack size', () => {
      loadSplitLines();
      (fixture.nativeElement.querySelectorAll('.delete-btn')[0] as HTMLButtonElement).click();
      const req = http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/carts/items/p1'));
      expect(req.request.params.get('weight')).toBe('250g');
      req.flush(null);
      fixture.detectChanges();

      expect(names()).toEqual(['Barfi 1kg x1']);
    });
  });
});
