import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideAppTesting } from '../../../../testing';
import { MessageManagement } from './message-management';

const message = (id: string, name: string, handled = false) => ({
  id, name, email: name.toLowerCase() + '@example.com', phone: id === 'm1' ? '9876543210' : null,
  message: 'Do you deliver to Waraseoni?', handled, createdAt: '2026-10-01T10:00:00Z',
});

describe('MessageManagement', () => {
  let fixture: ComponentFixture<MessageManagement>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const names = () => Array.from(el().querySelectorAll('.message .top strong')).map((n) => n.textContent!.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MessageManagement], providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MessageManagement);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const load = (messages: unknown[]) => {
    http.expectOne((r) => r.url.endsWith('/users/admin/contact')).flush(messages);
    fixture.detectChanges();
  };

  it('shows the messages waiting for a reply, with a reply link and the count', () => {
    load([message('m1', 'Ravi'), message('m2', 'Meena', true)]);

    expect(names()).toEqual(['Ravi']);
    expect(el().querySelector('.um-count .num')!.textContent).toBe('1');
    expect(el().querySelector('a[href^="mailto:ravi@example.com"]')).not.toBeNull();
    expect(el().querySelector('a[href="tel:9876543210"]')).not.toBeNull();
  });

  it('can include the handled ones too', () => {
    load([message('m1', 'Ravi'), message('m2', 'Meena', true)]);
    el().querySelector<HTMLInputElement>('.toggle input')!.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Ravi', 'Meena']);
  });

  it('marks a message handled and moves it out of the waiting list', () => {
    load([message('m1', 'Ravi')]);

    (Array.from(el().querySelectorAll<HTMLButtonElement>('.row button'))[0]).click();
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/users/admin/contact/m1/handled'));
    expect(req.request.params.get('handled')).toBe('true');
    req.flush(message('m1', 'Ravi', true));
    fixture.detectChanges();

    expect(names()).toEqual([]);
    expect(el().textContent).toContain('all caught up');
  });

  it('has a retry when the messages cannot be loaded', () => {
    http.expectOne((r) => r.url.endsWith('/users/admin/contact')).flush({}, { status: 500, statusText: 'err' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Could not load messages');

    (el().querySelector('.state .btn') as HTMLButtonElement).click();
    load([]);
    expect(el().textContent).toContain('all caught up');
  });
});
