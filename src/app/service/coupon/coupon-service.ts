import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CouponDto } from '../../model/order.model';

@Injectable({ providedIn: 'root' })
export class CouponService {
  private readonly couponUrl = `${environment.apiBaseUrl}/coupons`;

  constructor(private http: HttpClient) {}

  /** Look up a code before checkout, to preview what it does. Applying it (and enforcing
   *  validity/usage limits) happens server-side in CartService.placeOrder(). */
  find(code: string): Observable<CouponDto> {
    return this.http.get<CouponDto>(`${this.couponUrl}/${code}`);
  }

  /**
   * Client-side estimate only, mirrors OrderServiceImpl.computeDiscount() on the backend.
   * The real discount is always recalculated server-side at checkout - this is just for
   * showing the customer an estimated total before they commit.
   */
  estimateDiscount(coupon: CouponDto, subtotal: number): number {
    if (!coupon.active) return 0;
    if (coupon.minOrderValue != null && subtotal < coupon.minOrderValue) return 0;
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return 0;

    let discount =
      coupon.discountType === 'PERCENT' ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;

    if (coupon.discountType === 'PERCENT' && coupon.maxDiscount != null && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
    return Math.min(discount, subtotal);
  }
}