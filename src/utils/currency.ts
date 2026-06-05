const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

/** Format an integer amount of cents as a localized Euro string (e.g. 350 → "3,50 €"). */
export function formatCents(cents: number): string {
  return EUR.format(cents / 100);
}

/**
 * Parse a Euro string ("3,50", "3.50", "3") into an integer number of cents,
 * or `null` if it isn't a valid non-negative amount.
 */
export function parseEuroToCents(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Math.round(parseFloat(normalized) * 100);
}
