import { TestBed } from '@angular/core/testing';

import { AdminService } from './admin-service';

import { provideAppTesting } from '../../../testing';
describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    service = TestBed.inject(AdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
