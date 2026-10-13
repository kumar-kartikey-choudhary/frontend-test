import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { adminGuardGuard } from './admin-guard-guard';

import { provideAppTesting } from '../../../testing';
describe('adminGuardGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => adminGuardGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
