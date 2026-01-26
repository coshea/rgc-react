export function parseCurrencyInput(value: string): number {
  const parsed = parseFloat(value);
  return value.trim() && !Number.isNaN(parsed) && parsed > 0 ? parsed : 0;
}
