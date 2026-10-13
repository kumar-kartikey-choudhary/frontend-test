import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { PaymentManagement } from './payment-management';

import { provideAppTesting } from '../../../../testing';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';

const payment = (id: string, method: string, status: string) => ({
  id,
  orderId: 'order-' + id + '-xxxxxxxx',
  amount: 100,
  currency: 'INR',
  method,
  status,
  createdAt: '2026-10-01T10:01:00',
});

describe('PaymentManagement', () => {
  let component: PaymentManagement;
  let fixture: ComponentFixture<PaymentManagement>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [PaymentManagement],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PaymentManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers a refund only for money that went through the gateway', () => {
    http
      .expectOne((r) => r.url.endsWith('/payments/admin/all'))
      .flush([
        payment('upi', 'UPI', 'SUCCESS'),
        payment('codpaid', 'COD', 'SUCCESS'),
        payment('codwait', 'COD', 'PENDING'),
        payment('failed', 'UPI', 'FAILED'),
      ]);
    fixture.detectChanges();

    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    const row = (marker: string) => rows.find((r) => r.textContent!.includes(marker))!.textContent!;
    expect(row('order-upi')).toContain('Refund');
    expect(row('order-codpaid')).not.toContain('Refund');
    expect(row('order-codwait')).toContain('Mark collected');
    expect(row('order-codwait')).not.toContain('Refund');
    expect(row('order-failed')).not.toContain('Refund');
  });

  describe('refunding', () => {
    let confirm: ConfirmService;
    let toast: ToastService;
    const rowText = () => (fixture.nativeElement as HTMLElement).querySelector('tbody tr')!.textContent!;

    beforeEach(() => {
      confirm = TestBed.inject(ConfirmService);
      toast = TestBed.inject(ToastService);
      spyOn(toast, 'error');
      spyOn(toast, 'success');
      http.expectOne((r) => r.url.endsWith('/payments/admin/all')).flush([{ ...payment('upi', 'UPI', 'SUCCESS'), amount: 500 }]);
      fixture.detectChanges();
    });

    const clickRefund = async () => {
      ((fixture.nativeElement as HTMLElement).querySelector('tbody .btn-action:not(.btn-collect)') as HTMLButtonElement).click();
      await fixture.whenStable();
    };

    it('refunds everything that is left when the amount is left empty', async () => {
      spyOn(confirm, 'prompt').and.resolveTo('');
      await clickRefund();

      const req = http.expectOne((r) => r.url.endsWith('/refund'));
      expect(req.request.body.amount ?? null).toBeNull();
      req.flush({ status: 'REFUNDED', refundedAmount: 500 });
      fixture.detectChanges();

      expect(toast.success).toHaveBeenCalledWith('Refund issued.');
      expect(rowText()).not.toContain('Refund');   // nothing left to refund
    });

    it('sends the typed amount for a partial refund and keeps the Refund button for the rest', async () => {
      spyOn(confirm, 'prompt').and.resolveTo('120');
      await clickRefund();

      const req = http.expectOne((r) => r.url.endsWith('/refund'));
      expect(req.request.body.amount).toBe(120);
      req.flush({ status: 'SUCCESS', refundedAmount: 120 });
      fixture.detectChanges();

      expect(toast.success).toHaveBeenCalledWith(jasmine.stringContaining('Refunded ₹120'));
      expect(rowText()).toContain('₹ 120.00 refunded');
      expect(rowText()).toContain('Refund');
    });

    it('stops an amount that is not a positive number or is more than what is left', async () => {
      const prompt = spyOn(confirm, 'prompt');
      for (const typed of ['0', '-5', 'abc', '501']) {
        prompt.and.resolveTo(typed);
        await clickRefund();
      }
      http.expectNone((r) => r.url.endsWith('/refund'));
      expect(toast.error).toHaveBeenCalledTimes(4);
    });

    it('does nothing when the admin cancels the dialog', async () => {
      spyOn(confirm, 'prompt').and.resolveTo(null);
      await clickRefund();
      http.expectNone((r) => r.url.endsWith('/refund'));
    });
  });
});
