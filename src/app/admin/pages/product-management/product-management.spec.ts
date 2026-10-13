import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductManagement } from './product-management';

import { provideAppTesting } from '../../../../testing';
describe('ProductManagement', () => {
  let component: ProductManagement;
  let fixture: ComponentFixture<ProductManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [ProductManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
