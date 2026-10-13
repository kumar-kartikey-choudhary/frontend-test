import { mailtoHref, safeReturnUrl, telHref } from './safe-url.util';

describe('safeReturnUrl', () => {
  it('keeps ordinary same-site paths, with their query string', () => {
    expect(safeReturnUrl('/cart')).toBe('/cart');
    expect(safeReturnUrl('/payment?coupon=DIWALI50')).toBe('/payment?coupon=DIWALI50');
    expect(safeReturnUrl('/account?tab=addresses')).toBe('/account?tab=addresses');
  });

  it('refuses anything that could leave the site', () => {
    for (const bad of [
      'https://evil.example',
      'http://evil.example/cart',
      '//evil.example',
      '///evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      'evil.example',
      '',
    ]) {
      expect(safeReturnUrl(bad)).withContext(bad).toBeNull();
    }
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });

  it('refuses control characters and absurd lengths', () => {
    expect(safeReturnUrl('/cart\r\nSet-Cookie: x=1')).toBeNull();
    expect(safeReturnUrl('/' + 'a'.repeat(3000))).toBeNull();
  });

  it('does not send people back to the login or signup pages', () => {
    expect(safeReturnUrl('/login')).toBeNull();
    expect(safeReturnUrl('/signup?x=1')).toBeNull();
  });
});

describe('mailtoHref', () => {
  it('builds a normal link', () => {
    expect(mailtoHref('asha@example.com')).toBe('mailto:asha@example.com');
    expect(mailtoHref('asha@example.com', 'Re: hi there')).toBe('mailto:asha@example.com?subject=Re%3A%20hi%20there');
  });

  it('cannot be used to add headers through the address', () => {
    const href = mailtoHref('x?bcc=victim@example.com&subject=hi@example.com');
    expect(href.startsWith('mailto:')).toBeTrue();
    expect(href).not.toContain('?bcc=');
    expect(href.includes('?')).toBeFalse();
  });
});

describe('telHref', () => {
  it('keeps only dial characters', () => {
    expect(telHref('+91 (98765) 43210')).toBe('tel:+919876543210');
    expect(telHref('9876543210;ext=1<script>')).toBe('tel:98765432101');
  });
});
