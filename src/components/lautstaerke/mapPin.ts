import {MAP_BACKGROUND} from './mapStyle';

// A pin carries its location's current level, so it has to be wide enough for
// "87.3" — a pill when there's a number, and the bare dot when there isn't.
export const PIN_FILL = '#fafafa';
export const PIN_LABEL = '#18181b';
// Rounded rect 56×26, centred on the location like the dot is.
const PILL_PATH =
  'M -15,-13 h 30 a 13,13 0 0 1 0,26 h -30 a 13,13 0 0 1 0,-26 z';
const DOT_RADIUS = 13;
const PIN_FONT_SIZE = '13px';

// A pin's two looks. Shared so the dev samples below render through exactly the
// same code as the real pins rather than approximating them.
export const pinIcon = (
  maps: typeof google.maps,
  withLabel: boolean,
): google.maps.Symbol => {
  const base = {
    fillColor: PIN_FILL,
    fillOpacity: 1,
    // A ring in the ground color separates overlapping pins.
    strokeColor: MAP_BACKGROUND,
    strokeWeight: 2,
  };
  return withLabel
    ? {...base, path: PILL_PATH, labelOrigin: new maps.Point(0, 0)}
    : {...base, path: maps.SymbolPath.CIRCLE, scale: DOT_RADIUS};
};

export const pinLabel = (text: string): google.maps.MarkerLabel | null =>
  text
    ? {text, color: PIN_LABEL, fontSize: PIN_FONT_SIZE, fontWeight: '700'}
    : null;
