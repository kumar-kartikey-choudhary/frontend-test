/** Backend Category enum values (product-api / enums/Category.java) -> display name and listing route. */
export const CATEGORY_INFO: Record<string, { label: string; route: string }> = {
  Dairy: { label: 'Dairy', route: '/products/dairy' },
  Sweets: { label: 'Sweets', route: '/products/sweets' },
  Snacks: { label: 'Snacks & Namkeen', route: '/products/snacks' },
  Cold_Drinks: { label: 'Cold Drinks', route: '/products/drink' },
  Bakery: { label: 'Bakery', route: '/products/other' },
};

export function categoryLabel(category: string | undefined): string {
  return (category && CATEGORY_INFO[category]?.label) || category?.replace(/_/g, ' ') || 'Products';
}

export function categoryRoute(category: string | undefined): string {
  return (category && CATEGORY_INFO[category]?.route) || '/products';
}
