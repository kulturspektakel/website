// How much of a window a Leq actually had to work with, and how to say so. The mean
// itself is below; this half is about the caveat on it.
//
// A Leq over a crop is an average of the minutes that were *measured*, so how many there
// were is part of the reading: without it a place monitored for two minutes of an hour is
// indistinguishable from one monitored throughout. Treating a gap as silence would drag
// the level down instead, which is worse than disclosing the gap.
export type Coverage = {
  // Minutes that actually have a reading, against the minutes we could expect one for.
  minutes: number;
  expectedMinutes: number;
};

// Whether the shortfall is worth mentioning at all, and both thresholds are needed. The
// bounds of a crop are arbitrary while the data is minute-resolution, so the expected
// count is only good to ±1: on a ratio test alone a 90-second crop holding its one whole
// minute would report "50 % gemessen". And a single minute dropped from an hour is noise,
// not a caveat worth printing.
const MIN_MISSING_MINUTES = 2;
const MIN_COVERAGE = 0.95;

/**
 * The same shortfall spelled out, for somewhere with room for a sentence — the list
 * row shows a warning sign rather than the note, and this is what hovering it says.
 *
 * Undefined on the same terms as the note above, so a caller picking one of the two
 * wordings never has to consult the other about whether to say anything at all.
 */
export function coverageDetail(totals: Coverage): string | undefined {
  const {minutes, expectedMinutes} = totals;
  return worthDisclosing(totals)
    ? `Only ${minutes} of ${expectedMinutes} minutes in the range measured (${coveredPercent(totals)} %)`
    : undefined;
}

// The thresholds, in the one place both wordings ask about them. A window of no
// elapsed minutes is ruled out here, which is also what keeps the divide below safe.
const worthDisclosing = ({minutes, expectedMinutes}: Coverage): boolean =>
  expectedMinutes > 0 &&
  expectedMinutes - minutes >= MIN_MISSING_MINUTES &&
  minutes / expectedMinutes < MIN_COVERAGE;

const coveredPercent = ({minutes, expectedMinutes}: Coverage): number =>
  Math.round((minutes / expectedMinutes) * 100);

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
//
// The three primitives are exported because the project page does not use the loop:
// it sums the same energies once into a running total (see locationEnergyIndex) so that a
// timeline drag costs a subtraction rather than a pass over the crop. Two spellings of
// "what a Leq is" would be one too many, so both read them from here.

// A minute the mean may count. Non-finite is treated as absent rather than clamped:
// the device didn't report a level, whatever it put in the column.
export const usableDb = (v: number | null | undefined): v is number =>
  v != null && Number.isFinite(v);
export const toEnergy = (db: number): number => 10 ** (db / 10);
export const fromEnergy = (mean: number): number => 10 * Math.log10(mean);

// `from`/`to` bound the range without slicing it, so a caller holding a long column
// can average a window of it without copying one out.
export function energeticMeanDb(
  values: ReadonlyArray<number | null>,
  from = 0,
  to = values.length,
): number | null {
  let sum = 0;
  let n = 0;
  for (let i = from; i < to; i++) {
    const v = values[i];
    if (!usableDb(v)) continue;
    sum += toEnergy(v);
    n++;
  }
  return n === 0 ? null : fromEnergy(sum / n);
}
