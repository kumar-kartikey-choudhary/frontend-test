import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import { AuthService } from '../login/auth-service';
import { CartService } from './CartService';

describe('CartService', () => {
  let cart: CartService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    // Pretend someone is signed in; the cart only talks to the backend for signed-in users.
    spyOn(TestBed.inject(AuthService), 'isLoggedIn').and.returnValue(true);
    cart = TestBed.inject(CartService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('counts packs across lines once the cart is synced, and empties on reset', () => {
    cart.syncCartFromBackend();
    http.expectOne((r) => r.url.endsWith('/carts')).flush([
      { productId: 'p1', weight: '250g', quantity: 2 },
      { productId: 'p2', weight: '1kg', quantity: 3 },
    ]);
    expect(cart.itemCount()).toBe(5);
    expect(cart.getQuantity('p1', '250g')).toBe(2);

    cart.reset();
    expect(cart.itemCount()).toBe(0);
  });

  it('keeps the same product at different pack sizes as separate lines', () => {
    cart.syncCartFromBackend();
    http.expectOne((r) => r.url.endsWith('/carts')).flush([
      { productId: 'p1', weight: '250g', quantity: 2 },
      { productId: 'p1', weight: '1kg', quantity: 1 },
    ]);
    expect(cart.itemCount()).toBe(3);
    expect(cart.getQuantity('p1', '250g')).toBe(2);
    expect(cart.getQuantity('p1', '1kg')).toBe(1);
    expect(cart.getQuantity('p1', '500g')).toBe(0);
    expect(cart.linesOf('p1')).toEqual([
      { weight: '250g', quantity: 2 },
      { weight: '1kg', quantity: 1 },
    ]);
  });

  it('adding another pack size of a product adds a line and leaves the first one alone', () => {
    cart.addToCart('p1', '250g', 2);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '250g', quantity: 2 });
    cart.addToCart('p1', '1kg', 1);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '1kg', quantity: 1 });

    expect(cart.getQuantity('p1', '250g')).toBe(2);
    expect(cart.getQuantity('p1', '1kg')).toBe(1);
    expect(cart.itemCount()).toBe(3);
  });

  it('records the quantity after a successful add and clears the busy flag', () => {
    cart.addToCart('p1', '500g', 2);
    expect(cart.isLoading('p1', '500g')).toBeTrue();
    expect(cart.isLoading('p1', '1kg')).toBeFalse(); // only that pack size is busy
    http.expectOne((r) => r.url.endsWith('/carts/items') && r.method === 'POST').flush({ productId: 'p1', weight: '500g', quantity: 2 });
    expect(cart.getQuantity('p1', '500g')).toBe(2);
    expect(cart.isLoading('p1', '500g')).toBeFalse();
  });

  it('shows the total the server holds when more of an existing pack size is added', () => {
    cart.addToCart('p1', '500g', 2);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '500g', quantity: 2 });
    cart.addToCart('p1', '500g', 1);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '500g', quantity: 3 });
    expect(cart.getQuantity('p1', '500g')).toBe(3);
  });

  it('does NOT show the item as added when the server refuses (e.g. not enough stock)', () => {
    cart.addToCart('p1', '1kg');
    http
      .expectOne((r) => r.url.endsWith('/carts/items'))
      .flush({ message: "Only 2 kg of 'Kaju Katli' is available." }, { status: 409, statusText: 'Conflict' });
    expect(cart.getQuantity('p1', '1kg')).toBe(0);
    expect(cart.isLoading('p1', '1kg')).toBeFalse();
  });

  it('changes the quantity of one pack size only', () => {
    cart.addToCart('p1', '250g', 2);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '250g', quantity: 2 });
    cart.addToCart('p1', '1kg', 1);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '1kg', quantity: 1 });

    cart.increment('p1', '250g');
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/carts/items/p1'));
    expect(req.request.params.get('quantity')).toBe('3');
    expect(req.request.params.get('weight')).toBe('250g');
    req.flush({});

    expect(cart.getQuantity('p1', '250g')).toBe(3);
    expect(cart.getQuantity('p1', '1kg')).toBe(1);
  });

  it('decrementing the last pack removes just that line', () => {
    cart.addToCart('p1', '250g', 1);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '250g', quantity: 1 });
    cart.addToCart('p1', '1kg', 1);
    http.expectOne((r) => r.method === 'POST').flush({ productId: 'p1', weight: '1kg', quantity: 1 });

    cart.decrement('p1', '250g');
    const req = http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/carts/items/p1'));
    expect(req.request.params.get('weight')).toBe('250g');
    req.flush(null);

    expect(cart.isInCart('p1', '250g')).toBeFalse();
    expect(cart.isInCart('p1', '1kg')).toBeTrue();
    expect(cart.isInCart('p1')).toBeTrue();
  });

  it('clears the whole cart with one call and forgets the local counts', () => {
    cart.syncCartFromBackend();
    http.expectOne((r) => r.url.endsWith('/carts')).flush([
      { productId: 'p1', weight: '1kg', quantity: 2 },
      { productId: 'p2', weight: '1kg', quantity: 3 },
    ]);
    expect(cart.itemCount()).toBe(5);

    cart.clearCart().subscribe();
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/carts/clear')).flush(null);

    expect(cart.itemCount()).toBe(0);
    expect(cart.getQuantity('p1', '1kg')).toBe(0);
  });
});
