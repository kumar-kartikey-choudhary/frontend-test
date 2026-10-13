import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../../testing';
import { ConfirmService } from '../../../core/services/confirm.service';
import { NotificationManagement } from './notification-management';

describe('NotificationManagement', () => {
  let fixture: ComponentFixture<NotificationManagement>;
  let http: HttpTestingController;
  let confirm: ConfirmService;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [NotificationManagement], providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    confirm = TestBed.inject(ConfirmService);
    fixture = TestBed.createComponent(NotificationManagement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  async function type(id: string, value: string): Promise<void> {
    const field = el().querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const submit = async () => {
    el().querySelector<HTMLFormElement>('form.compose')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('sends to every customer by default, after asking', async () => {
    spyOn(confirm, 'confirm').and.resolveTo(true);
    await type('n-title', '  Diwali sale  ');
    await type('n-message', '20% off all sweets');
    await submit();

    const req = http.expectOne((r) => r.url.endsWith('/users/notifications/admin/send'));
    expect(req.request.body).toEqual({ audience: 'ALL_CUSTOMERS', username: undefined, type: 'PROMOTION', title: 'Diwali sale', message: '20% off all sweets' });
    req.flush({ sent: 42 });
    fixture.detectChanges();

    expect(el().textContent).toContain('Last send reached 42 customers');
    expect((el().querySelector('#n-title') as HTMLInputElement).value).toBe('');   // ready for the next one
  });

  it('can be aimed at one customer, who must be named', async () => {
    spyOn(confirm, 'confirm').and.resolveTo(true);
    const one = el().querySelector<HTMLInputElement>('input[name=audience][value=USER]')!;
    one.click();
    fixture.detectChanges();
    await fixture.whenStable();

    await type('n-title', 'Your order is ready');
    await submit();
    http.expectNone((r) => r.url.endsWith('/admin/send'));   // no username yet
    expect(el().textContent).toContain("Enter the customer's username");

    await type('n-username', ' asha ');
    await submit();
    const req = http.expectOne((r) => r.url.endsWith('/admin/send'));
    expect(req.request.body.audience).toBe('USER');
    expect(req.request.body.username).toBe('asha');
    req.flush({ sent: 1 });
  });

  it('needs a title and does not send if the admin backs out', async () => {
    await submit();
    http.expectNone((r) => r.url.endsWith('/admin/send'));
    expect(el().textContent).toContain('A title is required');

    spyOn(confirm, 'confirm').and.resolveTo(false);
    await type('n-title', 'Hello');
    await submit();
    http.expectNone((r) => r.url.endsWith('/admin/send'));
  });
});
