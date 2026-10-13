import { Pager } from '../../../shared/components/pager/pager';
import { Paginator } from '../../../shared/uti/paginator';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CouponService } from '../../../service/coupon/coupon-service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import type { CouponDto, DiscountType } from '../../../model/order.model';

interface CouponForm {
  id?: string;
  code: string;
  discountType: DiscountType;
  discountValue: number | null;
  minOrderValue: number | null;
  maxDiscount: number | null;
  /** <input type="datetime-local"> values: "YYYY-MM-DDTHH:mm" */
  validFrom: string;
  validTo: string;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  active: boolean;
}

const EMPTY_FORM: CouponForm = {
  code: '',
  discountType: 'PERCENT',
  discountValue: null,
  minOrderValue: null,
  maxDiscount: null,
  validFrom: '',
  validTo: '',
  usageLimit: null,
  usageLimitPerUser: null,
  active: true,
};

/** Backend returns "2026-10-08T10:00:00"; a datetime-local input wants "2026-10-08T10:00". */
const toInputDate = (value?: string): string => (value ? value.slice(0, 16) : '');

@Component({
  selector: 'app-coupon-management',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coupon-management.html',
  styleUrl: './coupon-management.css',
})
export class CouponManagement implements OnInit {
  private readonly couponService = inject(CouponService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly coupons = signal<CouponDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected form: CouponForm = { ...EMPTY_FORM };

  protected readonly searchTerm = signal('');
  /** Paging over the filtered list. */
  protected readonly pg = new Paginator(() => this.visible());

  protected readonly visible = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.coupons();
    return term ? list.filter((c) => c.code.toLowerCase().includes(term)) : list;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.couponService.findAll().subscribe({
      next: (list) => {
        this.coupons.set([...list].sort((a, b) => a.code.localeCompare(b.code)));
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected openNew(): void {
    this.form = { ...EMPTY_FORM };
    this.formOpen.set(true);
  }

  protected openEdit(coupon: CouponDto): void {
    this.form = {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderValue: coupon.minOrderValue ?? null,
      maxDiscount: coupon.maxDiscount ?? null,
      validFrom: toInputDate(coupon.validFrom),
      validTo: toInputDate(coupon.validTo),
      usageLimit: coupon.usageLimit ?? null,
      usageLimitPerUser: coupon.usageLimitPerUser ?? null,
      active: coupon.active,
    };
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected save(ngForm: NgForm): void {
    if (this.saving()) return;
    if (ngForm.invalid) {
      ngForm.control.markAllAsTouched();
      return;
    }
    if (this.form.validFrom && this.form.validTo && this.form.validTo <= this.form.validFrom) {
      this.toast.error('"Valid until" must be after "Valid from".');
      return;
    }
    if (this.form.discountType === 'PERCENT' && (this.form.discountValue ?? 0) > 100) {
      this.toast.error('A percentage discount cannot be more than 100.');
      return;
    }

    const payload: Partial<CouponDto> = {
      code: this.form.code.trim().toUpperCase(),
      discountType: this.form.discountType,
      discountValue: this.form.discountValue ?? 0,
      minOrderValue: this.form.minOrderValue ?? undefined,
      // A cap only means something for percentage discounts.
      maxDiscount: this.form.discountType === 'PERCENT' ? (this.form.maxDiscount ?? undefined) : undefined,
      validFrom: this.form.validFrom || undefined,
      validTo: this.form.validTo || undefined,
      usageLimit: this.form.usageLimit ?? undefined,
      usageLimitPerUser: this.form.usageLimitPerUser ?? undefined,
      active: this.form.active,
    };

    this.saving.set(true);
    const request$ = this.form.id
      ? this.couponService.update(this.form.id, payload)
      : this.couponService.create(payload);

    request$.subscribe({
      next: (saved) => {
        this.toast.success(`Coupon ${saved.code} ${this.form.id ? 'updated' : 'created'}.`);
        this.saving.set(false);
        this.formOpen.set(false);
        this.load();
      },
      // The server's message (e.g. "Coupon code 'X' already exists") is shown by the interceptor.
      error: () => this.saving.set(false),
    });
  }

  protected toggleActive(coupon: CouponDto): void {
    this.couponService.update(coupon.id, { ...coupon, active: !coupon.active }).subscribe({
      next: (updated) => {
        this.coupons.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        this.toast.success(`${updated.code} is now ${updated.active ? 'active' : 'inactive'}.`);
      },
    });
  }

  protected async remove(coupon: CouponDto): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Delete coupon ${coupon.code}?`,
      message:
        coupon.usedCount > 0
          ? `It has been used ${coupon.usedCount} time(s). Past orders keep their discount, but the code stops working. Consider deactivating it instead.`
          : 'The code will stop working immediately.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.couponService.delete(coupon.id).subscribe({
      next: () => {
        this.toast.success(`Coupon ${coupon.code} deleted.`);
        this.coupons.update((list) => list.filter((c) => c.id !== coupon.id));
      },
    });
  }

  protected describe(coupon: CouponDto): string {
    return coupon.discountType === 'PERCENT'
      ? `${coupon.discountValue}% off${coupon.maxDiscount ? ` (up to ₹${coupon.maxDiscount})` : ''}`
      : `₹${coupon.discountValue} off`;
  }
}
