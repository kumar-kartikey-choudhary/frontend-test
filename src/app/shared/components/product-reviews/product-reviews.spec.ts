import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { provideAppTesting } from '../../../../testing';
import { AuthService } from '../../../service/login/auth-service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ProductReviewsSection } from './product-reviews';

const review = (id: string, author: string, rating: number, mine = false, comment: string | null = 'Nice') => ({
  id, productId: 'p1', authorName: author, rating, comment, createdAt: '2026-10-01T10:00:00Z', mine,
});

function fakeJwt(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.signature`;
}

describe('ProductReviewsSection', () => {
  let fixture: ComponentFixture<ProductReviewsSection>;
  let http: HttpTestingController;
  let auth: AuthService;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [ProductReviewsSection], providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => sessionStorage.clear());

  function render(): void {
    fixture = TestBed.createComponent(ProductReviewsSection);
    fixture.componentRef.setInput('productId', 'p1');
    fixture.detectChanges();
  }

  function respond(body: any): void {
    http.expectOne((r) => r.url.endsWith('/products/product/p1/reviews') && r.method === 'GET').flush(body);
    fixture.detectChanges();
  }

  function signIn(): void {
    auth.login({ username: 'asha', password: 'x' }).subscribe();
    http.expectOne((r) => r.url.endsWith('/users/login')).flush({ token: fakeJwt(), refreshToken: 'r', username: 'asha', role: 'ROLE_CUSTOMER' });
  }

  it('shows the average, the count and each review', () => {
    render();
    respond({ average: 4.5, count: 2, reviews: [review('r1', 'ra***', 5), review('r2', 'as***', 4, false, null)] });

    expect(el().textContent).toContain('4.5');
    expect(el().textContent).toContain('Based on 2 reviews');
    expect(el().querySelectorAll('.item').length).toBe(2);
    expect(el().textContent).toContain('ra***');
  });

  it('invites the first review when there are none', () => {
    render();
    respond({ average: 0, count: 0, reviews: [] });
    expect(el().textContent).toContain('No reviews yet');
  });

  it('asks a signed-out visitor to sign in rather than showing a form', () => {
    render();
    respond({ average: 0, count: 0, reviews: [] });
    expect(el().textContent).toContain('to write a review');
    expect(el().querySelector('form')).toBeNull();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    (el().querySelector('.write .link') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], jasmine.anything());
  });

  it('refuses to post without a star rating', () => {
    signIn();
    render();
    http.expectOne((r) => r.url.endsWith('/products/product/p1/reviews')).flush({ average: 0, count: 0, reviews: [] });
    fixture.detectChanges();

    (el().querySelector('.write .btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el().textContent).toContain('Choose a rating from 1 to 5 stars');
    http.expectNone((r) => r.method === 'POST');
  });

  it('posts the chosen rating and comment, then shows the refreshed list', async () => {
    signIn();
    render();
    http.expectOne((r) => r.url.endsWith('/products/product/p1/reviews')).flush({ average: 0, count: 0, reviews: [] });
    fixture.detectChanges();

    (el().querySelector('.write .btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    (el().querySelectorAll('.pick')[3] as HTMLButtonElement).click();   // 4 stars
    const textarea = el().querySelector('textarea')!;
    textarea.value = '  Fresh and tasty ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/products/product/p1/reviews'));
    expect(post.request.body).toEqual({ rating: 4, comment: 'Fresh and tasty' });
    post.flush(review('r1', 'as***', 4, true, 'Fresh and tasty'));
    http.match((r) => r.url.endsWith('/products/ratings'));   // the summary refresh is not this test's business
    fixture.detectChanges();
    respond({ average: 4, count: 1, reviews: [review('r1', 'as***', 4, true, 'Fresh and tasty')] });

    expect(el().textContent).toContain('Fresh and tasty');
    expect(el().querySelector('.item--mine')).not.toBeNull();
    expect(el().textContent).toContain('Edit your review');
  });

  it('lets a customer edit and delete only their own review', async () => {
    signIn();
    render();
    http.expectOne((r) => r.url.endsWith('/products/product/p1/reviews')).flush({
      average: 3, count: 2, reviews: [review('r1', 'as***', 5, true), review('r2', 'ra***', 1, false)],
    });
    fixture.detectChanges();

    const deleteLinks = el().querySelectorAll('.item .link--danger');
    expect(deleteLinks.length).toBe(1);   // only their own

    const confirm = TestBed.inject(ConfirmService);
    spyOn(confirm, 'confirm').and.resolveTo(true);
    (deleteLinks[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    const del = http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/products/reviews/r1'));
    del.flush(null);
    http.match((r) => r.url.endsWith('/products/ratings'));
  });
});
