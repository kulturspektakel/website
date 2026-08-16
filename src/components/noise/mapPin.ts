import {themeHex} from '../../theme-noise';
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
export const PIN_FILL = themeHex('map.pin.fill');
export const PIN_LABEL = themeHex('map.pin.label');
// The same pin carrying a level we only remember: a greyed-down version of the
// pair above rather than a different shape, so it reads as the same badge turned
// down. Keeping dark-on-light means the number stays as legible as a live one —
// it's the badge that recedes into the basemap, not the digits.
const PIN_FILL_STALE = themeHex('map.pin.fillStale');
const PIN_LABEL_STALE = themeHex('map.pin.labelStale');
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

// A pin's two looks — reading now, and not. Shared so the dev samples render through
// exactly the same code as the real pins rather than approximating them.
export const pinIcon = (
  maps: typeof google.maps,
  stale = false,
): google.maps.Symbol => ({
  fillColor: stale ? PIN_FILL_STALE : PIN_FILL,
  fillOpacity: 1,
  // A ring in the ground color separates overlapping pins.
  strokeColor: themeHex('map.ground'),
  strokeWeight: 2,
  path: PILL_PATH,
  labelOrigin: new maps.Point(0, 0),
});

export const pinLabel = (
  text: string,
  stale = false,
): google.maps.MarkerLabel => ({
  text,
  color: stale ? PIN_LABEL_STALE : PIN_LABEL,
  className: PIN_LABEL_CLASS,
  fontFamily: PIN_FONT_FAMILY,
  fontSize: PIN_FONT_SIZE,
  fontWeight: '700',
});
