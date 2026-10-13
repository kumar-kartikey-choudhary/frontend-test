import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmService);
  });

  it('resolves true when confirmed and clears the dialog', async () => {
    const result = service.confirm({ title: 'Delete?' });
    expect(service.active()?.options.title).toBe('Delete?');
    service.active()!.resolve(true);
    expect(await result).toBeTrue();
    expect(service.active()).toBeNull();
  });

  it('resolves false when cancelled', async () => {
    const result = service.confirm({ title: 'Delete?' });
    service.active()!.resolve(false);
    expect(await result).toBeFalse();
  });

  it('prompt resolves with the text, or null when cancelled', async () => {
    const typed = service.prompt({ title: 'Reason', input: { label: 'Why?' } });
    service.active()!.resolve('out of stock');
    expect(await typed).toBe('out of stock');

    const cancelled = service.prompt({ title: 'Reason', input: { label: 'Why?' } });
    service.active()!.resolve(null);
    expect(await cancelled).toBeNull();
  });

  it('a second dialog cancels the first instead of leaving it hanging', async () => {
    const first = service.confirm({ title: 'First' });
    const second = service.confirm({ title: 'Second' });
    expect(await first).toBeFalse();
    expect(service.active()?.options.title).toBe('Second');
    service.active()!.resolve(true);
    expect(await second).toBeTrue();
  });
});
