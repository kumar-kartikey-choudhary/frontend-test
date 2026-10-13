/**
 * Production / default environment.
 *
 * The API base URL is no longer hard-coded inside each service. Change it here
 * (or via the `development` file replacement configured in angular.json).
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.pratikdairy.com',
  appName: 'Pratik Dairy & Sweets',
  /** The year the shop opened - the home page works out "over N years" from it, so it never goes stale. Set the real year. */
  foundedYear: 2001,
  /** Printed on invoices. */
  shop: {
    name: 'Pratik Dairy & Sweets',
    addressLines: ['Dindayal Chouk, Rampayli Road', 'Waraseoni, India - 481331'],
    email: 'info@pratikdairysweets.com',
  },
  supportPhone: '+91 7000628291',
  /** Milliseconds before token expiry at which the session is treated as expired. */
  tokenExpiryLeewayMs: 30_000,
};
