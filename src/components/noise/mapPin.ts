import {themeHex} from '../../theme-noise';
import {bandFill} from './pinScale';
import './mapPin.css';

// A pin carries its location's current level, so the pill is wide enough for "87.3".
//
// Always a pill, even with nothing to put in it: a location that is measuring nothing
// is exactly what someone scanning the map is looking for, and a bare dot said that by
// being smaller — which reads as "less" rather than "missing". So it keeps its badge,
// greyed like a remembered reading, and says so in place of a number.
//
// Resolved from the theme once at module load, not per marker: pinIcon and
// pinLabel run for every pin on every live update, so this must stay a lookup.
//
// PIN_FILL is what a pill is when it is *not* carrying a level — the placeholder, and the
// dev samples. A pin with a number in it takes its fill off the ramp instead (see
// pinScale), which is the whole of what the map's colour says.
export const PIN_FILL = themeHex('map.pin.fill');
export const PIN_LABEL = themeHex('map.pin.label');
// The same pin carrying a level we only remember: a greyed-down version of the
// pair above rather than a different shape, so it reads as the same badge turned
// down. Keeping dark-on-light means the number stays as legible as a live one —
// it's the badge that recedes into the basemap, not the digits.
const PIN_FILL_STALE = themeHex('map.pin.fillStale');
const PIN_LABEL_STALE = themeHex('map.pin.labelStale');
// A pin over its limit: a red pill, with the number and the triangle ahead of it in white.
// Red rather than a band, because over the limit is the thing the pin has to say first —
// how loud it is exactly is still the number.
const PIN_FILL_OVER = themeHex('map.pin.fillOver');
const PIN_OVER = themeHex('map.pin.over');
// Rounded rect 56×26, centred on the location.
const PILL_PATH =
  'M -15,-13 h 30 a 13,13 0 0 1 0,26 h -30 a 13,13 0 0 1 0,-26 z';
const PIN_FONT_SIZE = '13px';

// What a pin says when there is no level to say: digit-shaped, so the pill holds the
// width it has with a number in it and a location that goes quiet doesn't twitch.
// Deliberately not formatDb's em dash, which is the page's mark for "no reading" in
// running text — here the placeholder has to occupy the same space as "87.3".
export const NO_LEVEL_LABEL = '--.-';
// The label is a level that's re-set about once a second, and it's centred in the
// pill — with proportional figures every digit that changes width shifts the whole
// number. Tabular figures fix the advance without going monospace, and they need
// both halves of this: the family, because the Maps default (Roboto, falling back
// to Arial) exposes no `tnum` feature and ignores the request outright, and the
// class, because the API takes no arbitrary style on a marker label (see
// mapPin.css). system-ui is the crew theme's body font, so the pin also stops
// being the one thing on the page set in someone else's typeface.
const PIN_FONT_FAMILY = 'system-ui, sans-serif';
const PIN_LABEL_CLASS = 'noise-pin-label';
const PIN_LABEL_IGNORED_CLASS = 'noise-pin-label-ignored';
const PIN_LABEL_NAME_CLASS = 'noise-pin-label-name';
// A name is words, not a number: a size down from the digits, so a little more of it fits
// in a pill that is not getting any wider for it.
const PIN_NAME_FONT_SIZE = '11px';

/**
 * A pin, in whatever it has to say at once: how loud, whether that is a reading of the
 * instant being looked at, and whether it is over what was permitted.
 *
 * `db` is the fill, off the ramp. `stale` overrides that fill with grey — a level we only
 * remember is not a level to colour-code, and the ramp would have it shouting a loudness
 * that is no longer the case. `over` overrides it with red — the whole of how a pin says it
 * is over its limit, the same as a card's tile does (see ReadingTile). The two never meet: a
 * pin only warns about a reading of the instant being viewed (see LocationsMap), which a
 * stale one is not.
 */
export const pinIcon = (
  maps: typeof google.maps,
  {
    db,
    stale = false,
    over = false,
  }: {db?: number; stale?: boolean; over?: boolean} = {},
): google.maps.Symbol => ({
  fillColor: over
    ? PIN_FILL_OVER
    : stale
      ? PIN_FILL_STALE
      : db == null
        ? PIN_FILL
        : bandFill(db),
  fillOpacity: 1,
  // A ring in the ground color, on every pin alike: it is there to separate two badges that
  // overlap on screen, which is not a thing being over the limit changes. The warning is the
  // sign in the badge and nothing else — one mark for it, at the size the cards print it.
  strokeColor: themeHex('map.ground'),
  strokeWeight: 2,
  path: PILL_PATH,
  labelOrigin: new maps.Point(0, 0),
});

// One label colour for the whole ramp, the grey one for a level we only remember, and white
// on the red of a pin over its limit. That the six bands take the same dark digits is a
// property of the ramp rather than a coincidence (see theme-noise): a pin getting louder
// changes one thing about itself.
//
// An ignored pin is struck through: the grey it shares with a remembered reading says "not
// this", and the line says why — the number is there, but crew set it aside.
//
// A `named` pin carries its place's name instead of a level (see namePin), cut to the pill
// with an ellipsis rather than widening it (see mapPin.css).
export const pinLabel = (
  text: string,
  {
    stale = false,
    over = false,
    ignored = false,
    named = false,
  }: {stale?: boolean; over?: boolean; ignored?: boolean; named?: boolean} = {},
): google.maps.MarkerLabel => ({
  text,
  color: over ? PIN_OVER : stale ? PIN_LABEL_STALE : PIN_LABEL,
  className: [
    PIN_LABEL_CLASS,
    ignored && PIN_LABEL_IGNORED_CLASS,
    named && PIN_LABEL_NAME_CLASS,
  ]
    .filter(Boolean)
    .join(' '),
  fontFamily: PIN_FONT_FAMILY,
  fontSize: named ? PIN_NAME_FONT_SIZE : PIN_FONT_SIZE,
  fontWeight: '700',
});
