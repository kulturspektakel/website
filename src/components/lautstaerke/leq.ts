// The Leq for a whole selected timeframe, as the history loader computes it (see
// historyTotals). Lives here, on the client-safe side, so the view can type its
// loader data without importing the server module.
export type HistoryTotals = {
  // Leq over the whole window, per weighting; null when the window had no data.
  laeq: number | null;
  lceq: number | null;
  // Minutes that actually have a reading, against the minutes we could expect
  // one for. The Leq averages only the former, so the view surfaces the ratio
  // rather than letting a half-offline window read as "it was quiet then".
  minutes: number;
  expectedMinutes: number;
};

// How many one-minute readings a window could have produced by now. Measured
// against *elapsed* time, not the window's full span: a window ending in the
// future (every poll, and the picker's "last hour" default) hasn't missed the
// minutes that haven't happened yet, and would otherwise always look gappy.
export function expectedMinutes(start: Date, end: Date, now: number): number {
  const elapsedMs = Math.min(end.getTime(), now) - start.getTime();
  return Math.max(0, Math.round(elapsedMs / 60_000));
}

// How much of the window went unmeasured, as a note for the Leq tile — or
// undefined when the shortfall isn't worth disclosing.
//
// Both thresholds are needed. A window's bounds are arbitrary (a drag-zoom writes
// them straight into the URL) while the data is minute-resolution, so
// expectedMinutes is only good to ±1: on a ratio test alone a 90-second zoom
// holding its one whole minute would report "50 % Daten". And a single minute
// dropped from an hour is noise, not a caveat worth printing.
const MIN_MISSING_MINUTES = 2;
const MIN_COVERAGE = 0.95;

export function coverageNote(totals: HistoryTotals): string | undefined {
  const {minutes, expectedMinutes} = totals;
  if (expectedMinutes === 0) return undefined;
  if (expectedMinutes - minutes < MIN_MISSING_MINUTES) return undefined;
  const covered = minutes / expectedMinutes;
  return covered >= MIN_COVERAGE
    ? undefined
    : `${Math.round(covered * 100)} % Daten`;
}

// Leq over a set of equal-length sub-intervals is the *energetic* (power) mean,
// not the arithmetic one — decibels are logarithmic, so 60 dB and 70 dB average
// to 67.4 dB, not 65. Every NoiseLog row is exactly one 60-second aggregate, so
// all samples carry equal weight and no duration weighting is needed here.
//
//   Leq = 10 · log₁₀( mean( 10^(Lᵢ/10) ) )
//
// Nulls are skipped rather than counted as zero: a minute with no reading is a
// minute we know nothing about, not a silent one. Returns null when nothing is
// left to average, so callers render a dash instead of -Infinity.
export function energeticMeanDb(
  values: ReadonlyArray<number | null>,
): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += 10 ** (v / 10);
    n++;
  }
  return n === 0 ? null : 10 * Math.log10(sum / n);
}
