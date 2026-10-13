/**
 * Helpers for values that end up in a link or a redirect and can be influenced from outside the app
 * (a query string, text a visitor typed into a form).
 */

/**
 * A same-site path, or null. Used for `?returnUrl=` so a crafted login link can't send someone to
 * another website once they have signed in. Rejects absolute URLs ("https://evil.example"),
 * protocol-relative ones ("//evil.example"), backslash tricks ("/\evil.example") and control characters.
 */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2000) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  // The auth pages themselves are not a place to "return" to.
  const path = value.split(/[?#]/)[0];
  if (path === '/login' || path === '/signup') return null;
  return value;
}

/**
 * `mailto:` link for an address a visitor typed. The address is encoded so something like
 * "a?bcc=someone@else.com" can't smuggle extra headers (bcc, subject, body) into the mail client.
 */
export function mailtoHref(email: string | null | undefined, subject?: string): string {
  const address = encodeURIComponent((email ?? '').trim()).replace(/%40/g, '@');
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
}

/** `tel:` link containing only dial characters. */
export function telHref(phone: string | null | undefined): string {
  return 'tel:' + (phone ?? '').replace(/[^0-9+]/g, '');
}
