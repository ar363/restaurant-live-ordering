export function formatPrice(price: number): string {
  // Only show decimals if they're non-zero
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
}
