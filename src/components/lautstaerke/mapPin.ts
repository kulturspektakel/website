import {MAP_BACKGROUND} from './mapStyle';
import './mapPin.css';

// A pin carries its location's current level, so it has to be wide enough for
// "87.3" — a pill when there's a number, and the bare dot when there isn't.
export const PIN_FILL = '#fafafa';
export const PIN_LABEL = '#18181b';
// The same pin carrying a level we only remember: a greyed-down version of the
// pair above rather than a different shape, so it reads as the same badge turned
// down. Keeping dark-on-light means the number stays as legible as a live one —
// it's the badge that recedes into the basemap, not the digits.
const PIN_FILL_STALE = '#a1a1aa';
const PIN_LABEL_STALE = '#3f3f46';
// Rounded rect 56×26, centred on the location like the dot is.
const PILL_PATH =
  'M -15,-13 h 30 a 13,13 0 0 1 0,26 h -30 a 13,13 0 0 1 0,-26 z';
const DOT_RADIUS = 13;
const PIN_FONT_SIZE = '13px';
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

// A pin's two looks. Shared so the dev samples below render through exactly the
// same code as the real pins rather than approximating them.
export const pinIcon = (
  maps: typeof google.maps,
  withLabel: boolean,
  stale = false,
): google.maps.Symbol => {
  const base = {
    fillColor: stale ? PIN_FILL_STALE : PIN_FILL,
    fillOpacity: 1,
    // A ring in the ground color separates overlapping pins.
    strokeColor: MAP_BACKGROUND,
    strokeWeight: 2,
  };
  return withLabel
    ? {...base, path: PILL_PATH, labelOrigin: new maps.Point(0, 0)}
    : {...base, path: maps.SymbolPath.CIRCLE, scale: DOT_RADIUS};
};

export const pinLabel = (
  text: string,
  stale = false,
): google.maps.MarkerLabel | null =>
  text
    ? {
        text,
        color: stale ? PIN_LABEL_STALE : PIN_LABEL,
        className: PIN_LABEL_CLASS,
        fontFamily: PIN_FONT_FAMILY,
        fontSize: PIN_FONT_SIZE,
        fontWeight: '700',
      }
    : null;
