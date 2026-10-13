import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import type { Product } from '../../model';
import { WishlistService } from '../../service/wishlist/wishlist-service';
import { Wishlist } from './wishlist';

const make = (id: string, productName: string): Product => ({
  id, productName, price: 100, available: true, stockQuantity: 10, stockUnit: 'kg', category: 'Sweets',
  description: '', manufactureDate: '', expiryDate: '', status: 'In Stock', images: [],
});

describe('Wishlist page', () => {
  let fixture: ComponentFixture<Wishlist>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const titles = () => Array.from(el().querySelectorAll('.title')).map((t) => t.textContent!.trim());
  const listRequest = () => http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/products/wishlist'));

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [Wishlist], providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Wishlist);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.match((r) => r.url.endsWith('/products/ratings'));
    http.verify();
  });

  it('lists the saved products', () => {
    expect(el().textContent).toContain('Loading your wishlist');
    listRequest().flush([make('p1', 'Kaju Katli'), make('p2', 'Paneer')]);
    fixture.detectChanges();
    expect(titles()).toEqual(['Kaju Katli', 'Paneer']);
  });

  it('shows a friendly empty state', () => {
    listRequest().flush([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Nothing saved yet');
    expect(el().querySelector('a[href="/products"]')).not.toBeNull();
  });

  it('takes a product off the page the moment its heart is switched off', () => {
    listRequest().flush([make('p1', 'Kaju Katli'), make('p2', 'Paneer')]);
    fixture.detectChanges();

    TestBed.inject(WishlistService).toggle('p1');   // what the heart does
    fixture.detectChanges();

    expect(titles()).toEqual(['Paneer']);
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/products/wishlist/p1')).flush(null);
  });

  it('offers a retry when the list cannot be loaded', () => {
    listRequest().flush({}, { status: 500, statusText: 'err' });
    fixture.detectChanges();
    expect(el().textContent).toContain("couldn't load your wishlist");

    (el().querySelector('.state .link') as HTMLButtonElement).click();
    fixture.detectChanges();
    listRequest().flush([make('p1', 'Kaju Katli')]);
    fixture.detectChanges();
    expect(titles()).toEqual(['Kaju Katli']);
  });
});
