import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Products } from './products';

import { provideAppTesting } from '../../../testing';
describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [Products],
    }).compileComponents();

    fixture = TestBed.createComponent(Products);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
