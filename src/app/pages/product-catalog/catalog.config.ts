/** Everything that differs between the category pages. One component renders them all. */
export interface CatalogConfig {
  /** Page heading in the banner. */
  title: string;
  subtitle: string;
  /** Backend Category enum values to list. */
  categories: string[];
  /** For the catch-all "other" page: list every category EXCEPT these. */
  excludeCategories?: string[];
  searchPlaceholder: string;
  /** Group the list under sweet sub-types (Kaju, Laddoo ...). */
  groupByType?: boolean;
  seoDescription: string;
  cta: {
    title: string;
    text?: string;
    links: { label: string; to: string; primary?: boolean }[];
  };
}

const MAIN_CATEGORIES = ['Dairy', 'Sweets', 'Snacks', 'Cold_Drinks'];

export const DAIRY_CATALOG: CatalogConfig = {
  title: 'Our Dairy Products',
  subtitle: 'Pure Milk. Pure Ingredients. Pure Trust. Taste the freshness delivered daily.',
  categories: ['Dairy'],
  searchPlaceholder: 'Search dairy products…',
  seoDescription: 'Fresh milk, paneer, ghee, curd and more from Pratik Dairy & Sweets.',
  cta: {
    title: 'Looking for Ghee or Festive Sweets?',
    links: [
      { label: 'View Sweets Menu', to: '/products/sweets', primary: true },
      { label: 'Bulk Order Inquiry', to: '/contact' },
    ],
  },
};

export const SWEETS_CATALOG: CatalogConfig = {
  title: 'The Sweets Menu',
  subtitle: 'Handmade with love, pure ghee and traditional recipes. Perfect for celebrations.',
  categories: ['Sweets'],
  groupByType: true,
  searchPlaceholder: 'Search by sweet name…',
  seoDescription: 'Traditional handmade mithai: laddoo, barfee, peda, jalebi and more.',
  cta: {
    title: 'Planning a Large Event?',
    text: 'We offer customized sweet boxes and bulk discounts for weddings and festivals.',
    links: [{ label: 'Inquire About Bulk Orders', to: '/contact', primary: true }],
  },
};

export const SNACKS_CATALOG: CatalogConfig = {
  title: 'Snacks & Namkeens',
  subtitle: 'Crunchy, savory and freshly packed - perfect with evening tea.',
  categories: ['Snacks'],
  searchPlaceholder: 'Search snacks and namkeens…',
  seoDescription: 'Crispy namkeen, chakli, gathiya and savory snacks, freshly packed.',
  cta: {
    title: 'Need snacks for a party or event?',
    text: 'We offer bulk packs for gatherings and celebrations.',
    links: [{ label: 'Bulk Order Inquiry', to: '/contact', primary: true }],
  },
};

export const DRINKS_CATALOG: CatalogConfig = {
  title: 'Soft Drinks & Essentials',
  subtitle: 'Your favorite carbonated beverages and chilled water, ready for pickup or delivery.',
  categories: ['Cold_Drinks'],
  searchPlaceholder: 'Search Coke, Sprite, Fanta…',
  seoDescription: 'Chilled soft drinks and bottled water from Pratik Dairy & Sweets.',
  cta: {
    title: 'Hosting a gathering?',
    text: 'Ask us about crates and bulk pricing.',
    links: [{ label: 'Contact Us', to: '/contact', primary: true }],
  },
};

export const OTHER_CATALOG: CatalogConfig = {
  title: 'More From Our Shop',
  subtitle: 'Bakery items and everything else we stock.',
  categories: [],
  excludeCategories: MAIN_CATEGORIES,
  searchPlaceholder: 'Search products…',
  seoDescription: 'Bakery items and other products from Pratik Dairy & Sweets.',
  cta: {
    title: "Can't find what you need?",
    links: [
      { label: 'Browse All Categories', to: '/products', primary: true },
      { label: 'Contact Us', to: '/contact' },
    ],
  },
};
