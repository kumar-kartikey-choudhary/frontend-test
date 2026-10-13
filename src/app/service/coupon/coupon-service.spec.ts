import { TestBed } from '@angular/core/testing';

import { CouponService } from './coupon-service';

import { provideAppTesting } from '../../../testing';
describe('CouponService', () => {
  let service: CouponService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    service = TestBed.inject(CouponService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
