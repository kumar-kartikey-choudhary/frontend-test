import { TestBed } from '@angular/core/testing';

import { ProductService } from './product-service';

import { provideAppTesting } from '../../../testing';
describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    service = TestBed.inject(ProductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
