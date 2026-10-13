import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../testing';
import { AddressService } from './address-service';

describe('AddressService', () => {
  let service: AddressService;
  let http: HttpTestingController;

  const address = { id: 'a1', label: 'Home', line1: '1 Main St', city: 'X', state: 'Y', pincode: '481331' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    service = TestBed.inject(AddressService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps the backend "default" flag to isDefault', () => {
    let result: { isDefault: boolean }[] = [];
    service.getAll().subscribe((list) => (result = list));
    http.expectOne((r) => r.url.endsWith('/users/addresses')).flush([
      { ...address, default: true },
      { ...address, id: 'a2', default: false },
    ]);
    expect(result.map((a) => a.isDefault)).toEqual([true, false]);
  });

  it('sends isDefault as "default" when creating', () => {
    service.create({ ...address, isDefault: true }).subscribe();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.body.default).toBeTrue();
    expect('isDefault' in req.request.body).toBeFalse();
    req.flush({ ...address, default: true });
  });

  it('never sends the default flag on update (the backend uses markDefault for that)', () => {
    service.update('a1', { ...address, isDefault: true }).subscribe();
    const req = http.expectOne((r) => r.method === 'PATCH');
    expect('default' in req.request.body).toBeFalse();
    expect('isDefault' in req.request.body).toBeFalse();
    req.flush(address);
  });
});
