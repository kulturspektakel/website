import {themeHex, type NoiseColorToken} from '../../theme-noise';

/**
 * How loud, as a colour — the scale the map's pins are filled by and the legend in its
 * corner spells out.
 *
 * Banded rather than continuous, and that is the decision the rest follows from. A
 * continuous ramp would put two stages four decibels apart in two shades nobody can tell
 * apart or name, and a map is read by comparing pins to each other and to a memory of what
 * the colours mean — which needs a small set of steps with numbers on them. Six is what
 * fits a legend that has to sit in the corner of a map without becoming furniture.
 *
 * Even 10 dB steps from 60, which is the range a festival is actually read over: a
 * residential measuring point sits in the first two bands, a stage in the last two, and the
 * boundary that matters most — 100 — is a boundary rather than the middle of a band. The
 * scale is open at both ends, so the quietest band means "60 or under" and the loudest
 * "100 or over"; a level below the chart's own floor is still a level, and clamping it to a
 * colour is the honest answer where the alternative is a pin with no fill.
 *
 * Deliberately not dbAxis' 30–110: that is the span a *trace* has to be drawn inside,
 * where the top and bottom exist so the line never leaves the plot. Nothing is drawn to
 * scale here — this is a lookup — so the two have no reason to agree, and 30–110 in six
 * bands would spend two of them on levels no monitor at a festival reports.
 */

// The floors, and the token each band is filled with. One list, in order, because the
// order *is* the scale: everything below reads it as "the last band whose floor this level
// clears", so a step inserted in the middle needs nothing else changed.
//
// The first floor is open below rather than a number, so `levelBand` needs no special case
// for a level under the scale and the legend has a boundary to *not* print (see the map's
// own legend, which labels the joints between bands and so has one fewer label than swatch).
const BANDS: ReadonlyArray<{floor: number; token: NoiseColorToken}> = [
  {floor: Number.NEGATIVE_INFINITY, token: 'map.pin.band.1'},
  {floor: 60, token: 'map.pin.band.2'},
  {floor: 70, token: 'map.pin.band.3'},
  {floor: 80, token: 'map.pin.band.4'},
  {floor: 90, token: 'map.pin.band.5'},
  {floor: 100, token: 'map.pin.band.6'},
];

// One band as everything downstream wants it: where it starts and what colour it is, the
// colour already resolved to a hex — the map layer cannot take a token (see themeHex) and
// the legend wants the very same value the pin is filled with, not a second name for it.
export type LevelBand = {floor: number; fill: string};

// Resolved once at module load, like the pin's own colours, because this is asked per pin
// per redraw and must stay a property read.
export const LEVEL_BANDS: readonly LevelBand[] = BANDS.map(
  ({floor, token}) => ({
    floor,
    fill: themeHex(token),
  }),
);

/**
 * Which band a level falls in — its index in LEVEL_BANDS.
 *
 * `[floor, next)`, the same half-open reading every window in this section is given: a
 * stage at exactly 90.0 is in the band 90 opens, not the one it closes. Which matters
 * precisely at the round numbers, since those are the ones a limit is written at and the
 * ones the legend prints.
 */
export const levelBand = (db: number): number => {
  let index = 0;
  for (let i = 1; i < LEVEL_BANDS.length; i++) {
    if (db >= LEVEL_BANDS[i]!.floor) index = i;
    else break;
  }
  return index;
};

// The fill for a level, which is the whole of what a pin asks. Its own function so the
// index — an implementation detail of an ordered list — stays inside this module for
// everything but the legend, which draws the list itself.
export const bandFill = (db: number): string =>
  LEVEL_BANDS[levelBand(db)]!.fill;
