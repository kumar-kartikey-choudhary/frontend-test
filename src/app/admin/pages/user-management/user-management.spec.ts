import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { UserManagement } from './user-management';
import { ConfirmService } from '../../../core/services/confirm.service';

import { provideAppTesting } from '../../../../testing';

const user = (id: string, username: string, emailVerified = false) => ({
  id, username, firstName: 'First', lastName: 'Last', email: username + '@example.com', role: 'CUSTOMER', emailVerified,
});

describe('UserManagement', () => {
  let component: UserManagement;
  let fixture: ComponentFixture<UserManagement>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [UserManagement],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function load(): void {
    http.expectOne((r) => r.url.endsWith('/users/admin/findAll')).flush([user('u1', 'asha', true), user('u2', 'ravi'), { ...user('u3', 'root'), role: 'ADMIN' }]);
    fixture.detectChanges();
  }

  it('should create', () => {
    http.expectOne((r) => r.url.endsWith('/users/admin/findAll')).flush([]);
    expect(component).toBeTruthy();
  });

  it('lists customers (not admins) with whether their email is confirmed', () => {
    load();
    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('confirmed');
    expect(rows()[1].textContent).toContain('not confirmed');
  });

  it('deletes a customer after confirmation and takes the row away', async () => {
    load();
    const confirm = TestBed.inject(ConfirmService);
    spyOn(confirm, 'confirm').and.resolveTo(true);

    (rows()[1].querySelector('.danger') as HTMLButtonElement).click();
    await fixture.whenStable();
    const req = http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/users/delete/u2'));
    req.flush(null);
    fixture.detectChanges();

    expect(rows().length).toBe(1);
    expect(el().textContent).not.toContain('ravi');
  });

  it('keeps the customer when the admin changes their mind', async () => {
    load();
    spyOn(TestBed.inject(ConfirmService), 'confirm').and.resolveTo(false);

    (rows()[0].querySelector('.danger') as HTMLButtonElement).click();
    await fixture.whenStable();

    http.expectNone((r) => r.method === 'DELETE');
    expect(rows().length).toBe(2);
  });

  it('keeps the row, and lets the admin try again, when the server refuses', async () => {
    load();
    spyOn(TestBed.inject(ConfirmService), 'confirm').and.resolveTo(true);

    (rows()[0].querySelector('.danger') as HTMLButtonElement).click();
    await fixture.whenStable();
    http.expectOne((r) => r.method === 'DELETE').flush({ message: 'nope' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(rows().length).toBe(2);
    expect((rows()[0].querySelector('.danger') as HTMLButtonElement).disabled).toBeFalse();
  });
});
