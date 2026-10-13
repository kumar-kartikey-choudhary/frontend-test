import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Product pages depend on live catalogue data and a dynamic id, so they render in the browser.
    path: 'products/item/:id',
    renderMode: RenderMode.Client,
  },
  {
    // The invoice is for one specific order, loaded for the signed-in customer.
    path: 'orders/:id/invoice',
    renderMode: RenderMode.Client,
  },
  {
    // Like reset-password, the token only exists in the browser's address bar.
    path: 'verify-email',
    renderMode: RenderMode.Client,
  },
  {
    // The reset link's token only exists in the browser's address bar, so this page can't be prerendered.
    path: 'reset-password',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
