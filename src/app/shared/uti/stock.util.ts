interface StockInfo {
  stockQuantity?: number;
  availability?: boolean;
}

export function isOutOfStock(product: StockInfo): boolean {
  return product.availability === false || (product.stockQuantity ?? 0) <= 0;
}