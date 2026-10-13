import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import { ReviewService } from './review-service';

describe('ReviewService', () => {
  let service: ReviewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    service = TestBed.inject(ReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the per-product ratings once however many cards ask', () => {
    service.loadSummaries();
    service.loadSummaries();
    service.loadSummaries();
    http.expectOne((r) => r.url.endsWith('/products/ratings')).flush([{ productId: 'p1', average: 4.2, count: 5 }]);

    expect(service.summaryFor('p1')).toEqual({ productId: 'p1', average: 4.2, count: 5 });
    expect(service.summaryFor('p2')).toBeUndefined();
  });

  it('tries again later if the first load failed', () => {
    service.loadSummaries();
    http.expectOne((r) => r.url.endsWith('/products/ratings')).flush({}, { status: 500, statusText: 'err' });
    service.loadSummaries();
    http.expectOne((r) => r.url.endsWith('/products/ratings')).flush([]);
  });

  it('refreshes the ratings after a review is saved or deleted', () => {
    service.loadSummaries();
    http.expectOne((r) => r.url.endsWith('/products/ratings')).flush([]);

    service.save('p1', 5, 'Lovely').subscribe();
    const post = http.expectOne((r) => r.url.endsWith('/products/product/p1/reviews'));
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ rating: 5, comment: 'Lovely' });
    post.flush({ id: 'r1' });
    http.expectOne((r) => r.url.endsWith('/products/ratings')).flush([{ productId: 'p1', average: 5, count: 1 }]);
    expect(service.summaryFor('p1')?.count).toBe(1);

    service.delete('r1').subscribe();
    const del = http.expectOne((r) => r.url.endsWith('/products/reviews/r1'));
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    http.expectOne((r) => r.url.endsWith('/products/ratings')).flush([]);
    expect(service.summaryFor('p1')).toBeUndefined();
  });
});
