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
// The warning, in the one colour the ramp does not use: the triangle inside a pin that is
// over its limit. Not a fill, because the fill is already saying how loud — a warning has to
// be able to sit on any band without replacing what that band said.
const PIN_OVER = themeHex('map.pin.over');
// Rounded rect 56×26, centred on the location.
const PILL_PATH =
  'M -15,-13 h 30 a 13,13 0 0 1 0,26 h -30 a 13,13 0 0 1 0,-26 z';
// The same pill with room for the warning sign ahead of the number: 16px wider, and still
// centred on the location, because where the pin *points* is not something a warning may
// move. What gives is the number, which slides right by half the extra (see OVER_LABEL_DX)
// so the sign gets the space rather than taking it out of the digits.
const OVER_EXTRA = 16;
const OVER_PILL_PATH = `M ${-15 - OVER_EXTRA / 2},-13 h ${
  30 + OVER_EXTRA
} a 13,13 0 0 1 0,26 h ${-30 - OVER_EXTRA} a 13,13 0 0 1 0,-26 z`;
const OVER_LABEL_DX = OVER_EXTRA / 2;
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

/**
 * A pin, in whatever it has to say at once: how loud, whether that is a reading of the
 * instant being looked at, and whether it is over what was permitted.
 *
 * Three separate channels on purpose, because a pin genuinely has three things to say and
 * collapsing any two of them loses one. `db` is the fill, off the ramp. `stale` overrides
 * that fill with grey — a level we only remember is not a level to colour-code, and the
 * ramp would have it shouting a loudness that is no longer the case. `over` is a sign of its
 * own precisely so it can sit on any fill: a stage may cross a limit at 78 dB where the
 * permit is written low, and a warning that had to be a colour would have to argue with the
 * band for the pill. Here it only widens the badge and shifts the digits over; the sign
 * itself is a second marker (see warningIcon).
 */
export const pinIcon = (
  maps: typeof google.maps,
  {
    db,
    stale = false,
    over = false,
  }: {db?: number; stale?: boolean; over?: boolean} = {},
): google.maps.Symbol => ({
  fillColor: stale ? PIN_FILL_STALE : db == null ? PIN_FILL : bandFill(db),
  fillOpacity: 1,
  // A ring in the ground color, on every pin alike: it is there to separate two badges that
  // overlap on screen, which is not a thing being over the limit changes. The warning is the
  // sign in the badge and nothing else — one mark for it, at the size the cards print it.
  strokeColor: themeHex('map.ground'),
  strokeWeight: 2,
  path: over ? OVER_PILL_PATH : PILL_PATH,
  // The number keeps the middle of the *number's* half of the badge, not the middle of the
  // badge: shifted right by the room the sign was given, so the digits stay centred in what
  // is left and a pin crossing its limit doesn't look like it lost a character.
  labelOrigin: new maps.Point(over ? OVER_LABEL_DX : 0, 0),
});

// The warning triangle inside a pin, just before the number — the half of the warning that
// is not a colour, for the reader colour does not reach: a red-green deficiency, a phone in
// the sun, a glance from across the field. A shape, because that is the one property of a
// mark that survives all three.
//
// Inside the badge and not off its corner, because it is the number it qualifies: read left
// to right, "⚠ 88.4" is one statement, where a mark floating past the edge was a second
// thing near the pin and had to be tied back to it. It is where the cards put theirs, too.
//
// The very sign the cards already warn with (see LocationReadings): heroicons' *mini*
// exclamation triangle, which is drawn on a 20px grid for exactly this size — rounded
// corners, and the "!" knocked out by fill-rule rather than left as a hairline that
// smudges. One page, one warning sign, whether it is beside a number or over a stage.
//
// Its path is copied rather than imported because a marker cannot take a React component,
// and react-icons ships these only as components. The duplication is a literal of the
// artwork, so it goes stale only if heroicons redraws the glyph — in which case the two
// look different, which is the visible kind of stale.
const WARNING_PATH =
  'M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z';

// Drawn as its own marker rather than folded into the pill's path: the sign is a second
// colour on top of the badge's fill, which one filled path cannot be. What keeps the two
// together is that the badge makes room for it — the wide pill is drawn only when the sign
// is (see OVER_PILL_PATH), so neither is ever on the map without the other.
//
// An image and not a google.maps.Symbol, which is what every other icon in this file is. A
// Symbol takes a path but no fill rule, so the "!" — cut out of the triangle by an even-odd
// fill — would come back filled in and leave a plain yellow lozenge. An inline SVG is
// rendered by the browser, which honours it, so what lands on the map is the glyph the cards
// show and not an approximation of it.
//
// Cap height of the digits beside it, near enough: the sign is a word in the same line, so
// it is set at the size of one and not at the size of a badge.
const WARNING_SIZE = 14;
// Where the glyph's middle falls relative to the location the pin points at. The over-limit
// pill runs from -36 to +36 with the digits centred at +8 (see OVER_PILL_PATH), so the sign
// goes in the space left of them — set a little nearer the number than the badge's own edge,
// because it belongs to the number and not to the badge. Vertically on the digits' line,
// which is the whole of what makes it inline.
const WARNING_OFFSET = {x: -18, y: 0} as const;

// Encoded once at module load, like every colour here: this is asked for whenever the set
// of over-limit pins changes, and building a data URI per pin per redraw would be work done
// for an answer that cannot differ.
//
// The glyph alone, with nothing drawn behind it: inside the badge it has a flat ground of
// known colour to sit on, so the casing that let it survive landing on a photograph is a
// ring of basemap-grey through the middle of a pill. The knocked-out "!" shows the pill's
// own fill instead, which is what the cards do.
const WARNING_URL = `data:image/svg+xml,${encodeURIComponent(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">',
    `<path d="${WARNING_PATH}" fill="${PIN_OVER}" fill-rule="evenodd"/>`,
    '</svg>',
  ].join(''),
)}`;

export const warningIcon = (maps: typeof google.maps): google.maps.Icon => ({
  url: WARNING_URL,
  scaledSize: new maps.Size(WARNING_SIZE, WARNING_SIZE),
  // An image is hung by its anchor, so the anchor is where the *marker's* point should fall
  // inside it — the glyph's middle, moved back by the offset above, which comes out positive
  // on x because the sign sits to the left of the point it belongs to.
  anchor: new maps.Point(
    WARNING_SIZE / 2 - WARNING_OFFSET.x,
    WARNING_SIZE / 2 - WARNING_OFFSET.y,
  ),
});

// One label colour for the whole ramp, and the grey one for a level we only remember. That
// the six bands take the same dark digits is a property of the ramp rather than a
// coincidence (see theme-noise): a pin getting louder changes one thing about itself.
export const pinLabel = (
  text: string,
  {stale = false}: {stale?: boolean} = {},
): google.maps.MarkerLabel => ({
  text,
  color: stale ? PIN_LABEL_STALE : PIN_LABEL,
  className: PIN_LABEL_CLASS,
  fontFamily: PIN_FONT_FAMILY,
  fontSize: PIN_FONT_SIZE,
  fontWeight: '700',
});
