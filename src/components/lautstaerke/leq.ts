import {MINUTE_MS} from './timeframe';
import {type HistoryRow} from './noise';

// The Leq for a whole selected timeframe, plus how it's computed. Lives here,
// beside the energetic mean it's built on and away from the Prisma import, so
// the view can type its loader data and the maths can be unit-tested.
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
  return Math.max(0, Math.round(elapsedMs / MINUTE_MS));
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

// The two fields the note is computed from. Named so a caller that has measured a
// window but isn't a full HistoryTotals — the project page's per-device crop totals —
// can use the same rule rather than reimplementing the thresholds.
export type Coverage = Pick<HistoryTotals, 'minutes' | 'expectedMinutes'>;

export function coverageNote(totals: Coverage): string | undefined {
  return worthDisclosing(totals)
    ? `${coveredPercent(totals)} % Daten`
    : undefined;
}

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
    ? `Nur ${minutes} von ${expectedMinutes} Minuten im Zeitraum gemessen (${coveredPercent(totals)} %)`
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

// The single Leq for the selected timeframe, both weightings so the A/C toggle
// needs no refetch. Read off the named HistoryRow fields rather than the aligned
// columns, so a SERIES reorder can't silently change which level this averages.
// Rows are already one-per-minute and equally weighted, so this is a plain
// energetic mean — see energeticMeanDb for why it isn't an arithmetic one.
//
// A gap is an *absent row*, not a null: NoiseLog.laeq/lceq are NOT NULL, so unlike
// the 5m/30m columns these two are always present on a row that exists. The mean is
// therefore over the minutes that were measured (standard Leq-over-measured-time) —
// treating a gap as silence would drag the level down and misrepresent it, so the
// caller gets `minutes`/`expectedMinutes` to disclose how much was actually covered.
export function historyTotals(
  rows: HistoryRow[],
  start: Date,
  end: Date,
  now = Date.now(),
): HistoryTotals {
  return {
    laeq: energeticMeanDb(rows.map((r) => r.laeq_1m)),
    lceq: energeticMeanDb(rows.map((r) => r.lceq_1m)),
    minutes: rows.length,
    expectedMinutes: expectedMinutes(start, end, now),
  };
}
