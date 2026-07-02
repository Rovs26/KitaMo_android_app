export function isLowStock(stockQty: number, lowStockThreshold: number) {
  return stockQty <= lowStockThreshold;
}
