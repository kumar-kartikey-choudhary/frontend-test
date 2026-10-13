import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { OrderManagement } from './order-management';

import { provideAppTesting } from '../../../../testing';

const order = (id: string, status: string) => ({
  id,
  username: 'asha',
  orderDateTime: '2026-10-01T10:00:00',
  status,
  subtotalAmount: 100,
  discountAmount: 0,
  totalAmount: 100,
  items: [],
  statusHistory: [],
});

describe('OrderManagement', () => {
  let component: OrderManagement;
  let fixture: ComponentFixture<OrderManagement>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [OrderManagement],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('locks the status of delivered and cancelled orders, which the server treats as final', () => {
    http
      .expectOne((r) => r.url.endsWith('/orders/admin/findAll'))
      .flush([order('aaaaaaaa1', 'CONFIRMED'), order('bbbbbbbb1', 'DELIVERED'), order('cccccccc1', 'CANCELLED')]);
    fixture.detectChanges();

    const selects = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>('select.status-action-select'),
    );
    expect(selects.length).toBe(3);
    expect(selects[0].disabled).toBeFalse();
    expect(selects[1].disabled).toBeTrue();
    expect(selects[2].disabled).toBeTrue();
    expect(selects[2].title).toContain('can no longer be changed');
  });
});
