import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Contact } from './contact';

import { provideAppTesting } from '../../../testing';
import { HttpTestingController } from '@angular/common/http/testing';
describe('Contact', () => {
  let component: Contact;
  let fixture: ComponentFixture<Contact>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [Contact],
    }).compileComponents();

    fixture = TestBed.createComponent(Contact);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('sending a message', () => {
    let http: HttpTestingController;
    const el = () => fixture.nativeElement as HTMLElement;

    beforeEach(async () => {
      http = TestBed.inject(HttpTestingController);
      await fixture.whenStable();
    });

    afterEach(() => http.verify());

    async function fill(values: Record<string, string>): Promise<void> {
      for (const [id, value] of Object.entries(values)) {
        const field = el().querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)!;
        field.value = value;
        field.dispatchEvent(new Event('input'));
      }
      fixture.detectChanges();
      await fixture.whenStable();
    }

    const submit = () => {
      el().querySelector<HTMLFormElement>('form.contact-form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };

    const valid = { 'c-name': '  Ravi K ', 'c-email': 'ravi@example.com', 'c-phone': '9876543210', 'c-message': 'Do you deliver to Waraseoni?' };

    it('sends nothing until the name, email and a real message are filled in', async () => {
      await fill({ 'c-name': 'Ravi', 'c-email': 'not-an-email', 'c-message': 'short' });
      submit();

      http.expectNone((r) => r.url.endsWith('/users/contact'));
      expect(el().textContent).toContain('Please fill in your name');
    });

    it('posts the message and then thanks the customer', async () => {
      await fill(valid);
      submit();

      const req = http.expectOne((r) => r.url.endsWith('/users/contact'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Ravi K', email: 'ravi@example.com', phone: '9876543210', message: 'Do you deliver to Waraseoni?' });
      req.flush(null, { status: 201, statusText: 'Created' });
      fixture.detectChanges();

      expect(el().textContent).toContain("We've received your message");
      expect(el().querySelector('form.contact-form')).toBeNull();

      (el().querySelector('.pd-alert + button') as HTMLButtonElement).click();   // "Send another message"
      fixture.detectChanges();
      expect(el().querySelector('form.contact-form')).not.toBeNull();
    });

    it('leaves out an empty phone number', async () => {
      await fill({ ...valid, 'c-phone': '' });
      submit();
      expect(http.expectOne((r) => r.url.endsWith('/users/contact')).request.body.phone).toBeUndefined();
    });

    it('shows the server\'s message when the customer has sent too many', async () => {
      await fill(valid);
      submit();
      http.expectOne((r) => r.url.endsWith('/users/contact')).flush(
        { message: "You've sent several messages recently. Please wait a while." }, { status: 429, statusText: 'Too Many Requests' });
      fixture.detectChanges();

      expect(el().textContent).toContain('several messages recently');
      expect(el().querySelector('form.contact-form')).not.toBeNull();   // they keep what they typed
    });

    it('says plainly when sending fails', async () => {
      await fill(valid);
      submit();
      http.expectOne((r) => r.url.endsWith('/users/contact')).flush({}, { status: 500, statusText: 'err' });
      fixture.detectChanges();
      expect(el().textContent).toContain("couldn't send your message");
    });
  });
});
