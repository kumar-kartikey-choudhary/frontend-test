import { TestBed } from '@angular/core/testing';

import { SignupService } from './signup-service';

import { provideAppTesting } from '../../../testing';
describe('SignupService', () => {
  let service: SignupService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    service = TestBed.inject(SignupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
