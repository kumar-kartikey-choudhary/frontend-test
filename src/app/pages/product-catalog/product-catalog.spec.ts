import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import type { Product } from '../../model';
import { DAIRY_CATALOG } from './catalog.config';
import { ProductCatalog } from './product-catalog';

const make = (id: string, productName: string, price: number, extra: Partial<Product> = {}): Product => ({
  id,
  productName,
  price,
  available: true,
  stockQuantity: 10,
  stockUnit: 'kg',
  category: 'Dairy',
  description: '',
  manufactureDate: '',
  expiryDate: '',
  status: 'In Stock',
  images: [],
  ...extra,
});

describe('ProductCatalog', () => {
  let fixture: ComponentFixture<ProductCatalog>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const titles = () => Array.from(el().querySelectorAll('.title')).map((t) => t.textContent!.trim());

  function render(): void {
    fixture = TestBed.createComponent(ProductCatalog);
    fixture.componentRef.setInput('config', DAIRY_CATALOG);
    fixture.detectChanges();
  }

  const respond = (products: Product[]) => {
    http.expectOne((r) => r.url.endsWith('/products/category/Dairy')).flush(products);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProductCatalog], providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
  });

  // The cards ask for the per-product ratings once; tests that don't care about stars just let that go unanswered.
  afterEach(() => {
    http.match((r) => r.url.endsWith('/products/ratings'));
    http.verify();
  });

  const sample = () => [
    make('1', 'Paneer', 300),
    make('2', 'Ghee', 800),
    make('3', 'Milk', 60, { stockUnit: 'litre', stockQuantity: 0 }),
  ];

  it('shows star ratings only on the products that have reviews', () => {
    render();
    respond(sample());
    http.expectOne((r) => r.url.endsWith('/products/ratings')).flush([{ productId: '1', average: 4.5, count: 12 }]);
    fixture.detectChanges();

    const cards = Array.from(el().querySelectorAll('app-product-card'));
    const paneer = cards.find((c) => c.textContent!.includes('Paneer'))!;
    const ghee = cards.find((c) => c.textContent!.includes('Ghee'))!;
    expect(paneer.querySelector('app-star-rating')!.textContent).toContain('(12)');
    expect(ghee.querySelector('app-star-rating')).toBeNull();
  });

  it('puts a wishlist heart on every product card', () => {
    render();
    respond(sample());
    expect(el().querySelectorAll('app-product-card app-wishlist-button button.heart').length).toBe(3);
  });

  it('shows placeholders while loading, then the products (in stock first)', () => {
    render();
    expect(el().querySelectorAll('.skeleton-card').length).toBeGreaterThan(0);
    respond(sample());
    expect(el().querySelectorAll('.skeleton-card').length).toBe(0);
    expect(titles()).toEqual(['Ghee', 'Paneer', 'Milk']); // sold-out Milk goes last
  });

  it('sorts by price and filters to in-stock items', () => {
    render();
    respond(sample());

    const select = el().querySelector<HTMLSelectElement>('.select select')!;
    select.value = 'price-asc';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(titles()).toEqual(['Milk', 'Paneer', 'Ghee']);

    el().querySelector<HTMLButtonElement>('.chip')!.click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Paneer', 'Ghee']);
  });

  it('searches after a short pause and can be cleared from the empty state', fakeAsync(() => {
    render();
    respond(sample());

    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'pan';
    input.dispatchEvent(new Event('input'));
    tick(100);
    fixture.detectChanges();
    expect(titles().length).toBe(3); // still debouncing - nothing filtered yet

    tick(200);
    fixture.detectChanges();
    expect(titles()).toEqual(['Paneer']);

    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    tick(300);
    fixture.detectChanges();
    expect(el().textContent).toContain('No products match');

    el().querySelector<HTMLButtonElement>('.state .btn')!.click();
    fixture.detectChanges();
    expect(titles().length).toBe(3);
  }));

  it('offers a retry when the products cannot be loaded', () => {
    render();
    http
      .expectOne((r) => r.url.endsWith('/products/category/Dairy'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain("couldn't load");

    el().querySelector<HTMLButtonElement>('[role="alert"] .btn')!.click();
    respond(sample());
    expect(titles().length).toBe(3);
  });
});
