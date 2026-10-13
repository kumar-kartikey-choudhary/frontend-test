import { Route, Routes } from '@angular/router';
import * as CATALOGS from './pages/product-catalog/catalog.config';
import { authGuardGuard } from './guard/auth-guard-guard'; // admin only
import { customerGuard } from './guard/customer-guard'; // any logged-in user

/** A category listing: the shared ProductCatalog page fed with one CatalogConfig via route data. */
function catalogRoute(path: string, title: string, config: keyof typeof CATALOGS): Route {
  return {
    path,
    title: `${title} | Pratik Dairy & Sweets`,
    data: { config: CATALOGS[config] },
    loadComponent: () =>
      import('./pages/product-catalog/product-catalog').then((m) => m.ProductCatalog),
  };
}

/**
 * All routes are lazy-loaded (including login/signup, which used to be eager
 * imports and therefore part of the initial bundle for every visitor).
 */
export const routes: Routes = [
  // ------------------------------------------------------------ PUBLIC
  {
    path: 'login',
    title: 'Login | Pratik Dairy & Sweets',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'forgot-password',
    title: 'Forgot your password? | Pratik Dairy & Sweets',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'Choose a new password | Pratik Dairy & Sweets',
    loadComponent: () => import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'verify-email',
    title: 'Confirm your email | Pratik Dairy & Sweets',
    loadComponent: () => import('./pages/verify-email/verify-email').then((m) => m.VerifyEmail),
  },
  {
    path: 'signup',
    title: 'Create an account | Pratik Dairy & Sweets',
    loadComponent: () => import('./pages/signup/signup').then((m) => m.Signup),
  },

  // ---------------------------------------------------------- CUSTOMER
  {
    path: '',
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        title: 'Fresh Dairy, Sweets & Namkeen | Pratik Dairy & Sweets',
        loadComponent: () => import('./pages/home/home').then((m) => m.Home),
      },
      {
        path: 'products',
        title: 'All Products | Pratik Dairy & Sweets',
        loadComponent: () => import('./pages/products/products').then((m) => m.Products),
      },
      {
        path: 'about',
        title: 'About Us | Pratik Dairy & Sweets',
        loadComponent: () => import('./pages/about/about').then((m) => m.About),
      },
      {
        path: 'contact',
        title: 'Contact Us | Pratik Dairy & Sweets',
        loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
      },

      // --- category pages: one component, configured per route (see catalog.config.ts) ---
      catalogRoute('products/dairy', 'Dairy Products', 'DAIRY_CATALOG'),
      catalogRoute('products/sweets', 'Sweets Menu', 'SWEETS_CATALOG'),
      catalogRoute('products/drink', 'Cold Drinks', 'DRINKS_CATALOG'),
      catalogRoute('products/snacks', 'Snacks & Namkeens', 'SNACKS_CATALOG'),
      catalogRoute('products/other', 'More Products', 'OTHER_CATALOG'),
      // Old/mistyped links used to land on the 404 page.
      { path: 'products/colddrinks', redirectTo: 'products/drink' },
      { path: 'products/cold-drinks', redirectTo: 'products/drink' },
      {
        // The title is set by the page itself once the product has loaded.
        path: 'products/item/:id',
        loadComponent: () =>
          import('./pages/product-detail/product-detail').then((m) => m.ProductDetail),
      },

      // --- authenticated ---
      {
        path: 'cart',
        title: 'Your Cart | Pratik Dairy & Sweets',
        canActivate: [customerGuard],
        loadComponent: () =>
          import('./pages/shopping-cart/shopping-cart').then((m) => m.ShoppingCart),
      },
      {
        path: 'payment',
        title: 'Payment | Pratik Dairy & Sweets',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/payment/payment/payment').then((m) => m.Payment),
      },
      {
        path: 'orders',
        title: 'My Orders | Pratik Dairy & Sweets',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/my-orders/my-orders').then((m) => m.MyOrders),
      },
      {
        path: 'wishlist',
        title: 'My Wishlist | Pratik Dairy & Sweets',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/wishlist/wishlist').then((m) => m.Wishlist),
      },
      {
        path: 'orders/:id/invoice',
        title: 'Invoice | Pratik Dairy & Sweets',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/invoice/invoice').then((m) => m.Invoice),
      },
      {
        path: 'account',
        title: 'My Account | Pratik Dairy & Sweets',
        canActivate: [customerGuard],
        loadComponent: () =>
          import('./pages/user-accounts/user-accounts').then((m) => m.UserAccounts),
      },
    ],
  },

  // ------------------------------------------------------------- ADMIN
  {
    path: 'admin',
    canActivate: [authGuardGuard],
    children: [
      // BUGFIX: this used to redirect to 'admin/login', a route that does not exist.
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Admin Dashboard | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/dashboard/dashboard').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'product',
        title: 'Product Management | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/product-management/product-management').then(
            (m) => m.ProductManagement,
          ),
      },
      {
        path: 'orders',
        title: 'Order Management | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/order-management/order-management').then((m) => m.OrderManagement),
      },
      {
        path: 'payments',
        title: 'Payment Management | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/payment-management/payment-management').then(
            (m) => m.PaymentManagement,
          ),
      },
      {
        path: 'coupons',
        title: 'Coupons | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/coupon-management/coupon-management').then((m) => m.CouponManagement),
      },
      {
        path: 'notifications',
        title: 'Send Notifications | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/notification-management/notification-management').then((m) => m.NotificationManagement),
      },
      {
        path: 'messages',
        title: 'Customer Messages | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/message-management/message-management').then((m) => m.MessageManagement),
      },
      {
        path: 'users',
        title: 'User Management | Pratik Dairy',
        loadComponent: () =>
          import('./admin/pages/user-management/user-management').then((m) => m.UserManagement),
      },
    ],
  },

  // BUGFIX: unknown URLs used to dump visitors on the login page. They now get
  // a real 404 page (and search engines get a proper "not found" signal).
  {
    path: '**',
    title: 'Page not found | Pratik Dairy & Sweets',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];