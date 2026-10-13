export const environment = {
  production: false,
  // Spring Cloud Gateway running locally
  apiBaseUrl: 'http://localhost:8080',
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
  tokenExpiryLeewayMs: 30_000,
};
