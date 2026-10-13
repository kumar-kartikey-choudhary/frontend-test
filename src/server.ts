import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environments/environment';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Don't announce the framework in every response.
app.disable('x-powered-by');

/**
 * Where the browser may send API calls. The origin of the API in environment.ts by default; set
 * API_ORIGIN when the API lives somewhere else than the build assumed.
 */
const apiOrigin = process.env['API_ORIGIN'] || new URL(environment.apiBaseUrl).origin;

/**
 * Content-Security-Policy: the browser only runs / loads what this lists.
 *  - scripts: this site, inline (Angular's server-rendered page needs it) and Razorpay Checkout
 *  - frames: Razorpay's payment window and the Google map on the Contact page; nobody may frame us
 *  - API calls: this site, our API and Razorpay
 *  - plugins (<object>), a changed <base> and form posts to other sites: not allowed
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://api.razorpay.com https://lumberjack.razorpay.com`,
  'frame-src https://api.razorpay.com https://checkout.razorpay.com https://maps.google.com https://www.google.com',
  'upgrade-insecure-requests',
].join('; ');

/** Security headers on every response (static files and rendered pages). */
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=()');
  // Keeps other sites' windows from holding a reference to ours, while still letting the payment pop-up work.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // HSTS only makes sense (and is only honoured) over HTTPS; behind a TLS-terminating proxy the proxy says so.
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    dotfiles: 'ignore', // never serve .env, .git and the like if one ever lands in the folder
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
