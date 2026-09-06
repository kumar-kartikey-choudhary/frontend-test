import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentManagement } from './payment-management';

describe('PaymentManagement', () => {
  let component: PaymentManagement;
  let fixture: ComponentFixture<PaymentManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
