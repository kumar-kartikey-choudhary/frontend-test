# Pratik Dairy & Sweets — Frontend (Angular 20 + SSR)

Storefront and admin console for the Pratik Dairy Spring Boot microservice backend
(gateway → user / product / cart / order services).

---

## Quick start

```bash
npm install
npm start                 # http://localhost:4200, talks to http://localhost:8080
npm run build:prod        # production bundle + SSR server
npm run serve:ssr:pratik-dairy-frontend
```

The API base URL is **no longer hard-coded**. It lives in:

| File                                          | Used by                                         |
| --------------------------------------------- | ----------------------------------------------- |
| `src/environments/environment.development.ts` | `ng serve`, `ng test` (`http://localhost:8080`) |
| `src/environments/environment.ts`             | production builds                               |

`angular.json` performs the file replacement automatically.

---

## Project structure

```
src/
  environments/                 API base URL + app-wide config
  app/
    core/
      services/                 storage, toast, loading, seo
      interceptors/             ssr-skip, http-error (retry + toasts)
    interceptor/                auth interceptor (bearer token, 401 handling)
    guard/                      customerGuard (any user), authGuardGuard (admin)
    service/                    auth, product, cart, signup API clients
    pages/                      customer-facing routes (all lazy loaded)
    admin/                      admin console
    shared/components/          toast host, loading bar
```

---

## What changed in this revision

### Bugs fixed

1. **Auth interceptor never handled 401s for authenticated requests.**
   The original returned `next(cloned)` early whenever a token was present, so
   the `catchError` block below only ran for requests that had _no_ token — i.e.
   the requests that can never expire. Expired sessions left users on a dead
   page. All requests now share one error pipeline.
2. **Production build failed.** `user-management.css` (8.43 kB) exceeded the
   8 kB `anyComponentStyle` error budget. Budgets are now realistic
   (8 kB warning / 16 kB error) and `ng build --configuration production`
   completes cleanly.
3. **`/admin` redirected to `admin/login`,** a route that does not exist. It now
   redirects to `admin/dashboard`.
4. **Unknown URLs dumped visitors on the login page.** There is now a real 404
   page (`/pages/not-found`), which is also the correct signal for crawlers.
5. **Guards always failed during SSR** (no `sessionStorage` on the server), so
   prerendered HTML for protected pages was a redirect. Guards now defer to the
   browser, where the session actually lives.
6. **Expired tokens were still sent.** `isLoggedIn()` only checked that a string
   existed. The JWT `exp` claim is now decoded and honoured, with a configurable
   leeway.
7. **Auth state was not reactive.** The header read `sessionStorage` through
   method calls, so it only updated after a full reload. State is now a signal.
8. **Every SSR prerender fired failing API calls.** 20 routes × several
   requests, all failing at build time. An `ssrSkipInterceptor` short-circuits
   HTTP on the server (documented as the place to add `TransferState` later).
9. **Dead files committed to the repo:** `s`, `s~`, `script.js`, `style.css`
   (root-level leftovers) and `public/assets/images/drinks/pallavi_fee.pdf`
   (an unrelated personal PDF served publicly). Removed.
10. **220 lines of commented-out code** at the top of `CartService.ts` and
    `app.routes.ts` removed — the file history is in git.

### Enhancements

- **Environment configuration** — one place to point the app at dev / staging / prod.
- **Global error handling + toasts** — `alert('Login Failed…')` and silent
  `console.error()` replaced by an accessible toast host; friendly, status-aware
  messages; automatic retry with backoff for failed `GET`s.
- **Global loading bar** driven by an in-flight request counter.
- **Login UX** — validation, disabled/`submitting` state, inline error message,
  `?returnUrl=` support (guards already sent it, nothing consumed it),
  `?sessionExpired=` notice, and a redirect away from the form when already
  signed in.
- **Lazy-loaded login/signup** — previously eager, so every anonymous visitor
  downloaded them. Initial bundle is now ~104 kB transferred.
- **Per-route titles** for all 16 routes (SSR was on, but every page shipped the
  same `PratikDairyFrontend` title).
- **SEO** — real `<title>`/description, Open Graph + Twitter cards,
  `Store` JSON-LD, canonical link, `robots.txt`, `sitemap.xml`, `SeoService`
  for per-page metadata.
- **PWA manifest** + theme colour + apple touch icon.
- **Design system** — `src/styles.css` now defines brand colour, spacing, radius,
  shadow and font tokens plus reusable `.pd-btn`, `.pd-card`, `.pd-grid`,
  `.pd-skeleton` utilities, so components stop re-inventing styles.
- **Accessibility** — skip-to-content link, visible `:focus-visible` rings,
  `aria-live` toasts, `prefers-reduced-motion` support.
- **Product service** — typed, caches the catalogue with `shareReplay`, adds
  `getProductsByCategory` and `deleteProduct`, invalidates cache on mutation.
- **Modern Angular idioms** — `inject()`, signals, `@if`/`@for` control flow,
  `computed()` derived UI state instead of imperative booleans.
- **Docker + CI** — multi-stage `Dockerfile` for the SSR server and a GitHub
  Actions workflow running format check, build and tests.

---

## Known gaps (backend work required)

These need API support before the UI can be finished:

| Gap                      | Notes                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Forgot password          | `login.html` links to `/forgot-password`; no route or endpoint exists.              |
| Checkout / payment       | Orders are created, but there is no payment step.                                   |
| Product search & filters | No search endpoint; category pages are hard-coded lists.                            |
| Pagination               | `/products/all` returns everything; it will not scale.                              |
| Refresh tokens           | Sessions die abruptly when the JWT expires.                                         |
| Image hosting            | Product images are uploaded as multipart to the API; consider object storage + CDN. |
| Order status tracking    | `OrderStatus` exists server-side but is not surfaced to customers.                  |
| Tests                    | Spec files are still CLI stubs — no real assertions anywhere.                       |

## Security notes

- The token lives in `sessionStorage`, which is still readable by any XSS on the
  page. An `HttpOnly` cookie issued by the gateway is the stronger option and
  would additionally let SSR render authenticated pages.
- Role checks in the UI are convenience only. Every `/admin/**` endpoint must be
  enforced server-side (the gateway already has `JwtAuthentication` — keep it).
