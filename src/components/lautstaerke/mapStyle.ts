import {themeHex} from '../../theme-noise';

// A dark, deliberately quiet basemap for the noise-project overview.
//
// Two kinds of colour here, kept apart on purpose. The four that have to agree
// with the rest of the page — the ground the tiles fade in from, and the type
// over it — are theme tokens, so the map reads as part of the page rather than
// an embedded widget. Everything else is MAP_RAMP below: a lightness ladder for
// basemap hierarchy, which has one consumer and means nothing outside this file.
// Promoting those to the design system would put a dozen single-use names into
// a vocabulary the rest of the app has to read past.
//
// Two rules shape the rest: buildings must stay — you place a microphone
// relative to the building it hangs on, so the footprints are the map's actual
// content — and everything that competes with the pins goes. That means POI and
// transit *labels* are off while their geometry stays (hiding a school's or a
// park's polygon would punch holes in the block pattern), and street names stay
// because once the pictograms are gone they're the only thing left to orient by.
//
// This is the legacy JSON `styles` array rather than a cloud-based map style,
// because a style configured in the Google Cloud console can't be reviewed or
// changed in this repo. Note the tradeoff: `styles` is ignored when a `mapId` is
// set, and `mapId` is what AdvancedMarkerElement requires — so this map stays on
// google.maps.Marker (deprecated but supported, and what GoogleMaps.tsx uses).
// The basemap's own ladder, darkest to lightest, so it reads as a ladder rather
// than as a dozen hexes scattered through a hundred lines of style objects. The
// ground it is built around is `map.ground`; mapStyle.test.ts pins that ordering
// so the ramp can be retuned without drifting off the page it sits on.
const MAP_RAMP = {
  water: '#0d0d10',
  natural: '#17171a',
  town: '#202024',
  poi: '#26262b',
  park: '#1e2620',
  road: '#2e2e33',
  roadLocal: '#33333a',
  roadArterial: '#41414a',
  roadHighway: '#52525b',
  // Bright for a gray this dark, on purpose: a building footprint is a hairline,
  // so it needs the contrast to survive antialiasing.
  buildings: '#7c7c88',
  roadLabel: '#8a8a94',
} as const;

// Built at map-init rather than kept as a module constant, so the dependency on
// the theme is visible where the map is created. Called twice a session.
export const darkMapStyle = (): google.maps.MapTypeStyle[] => [
  // Ground plane and label defaults; the stroke is a halo in the ground color so
  // text stays legible wherever it lands.
  {elementType: 'geometry', stylers: [{color: themeHex('map.ground')}]},
  {elementType: 'labels.text.fill', stylers: [{color: themeHex('map.label')}]},
  {
    elementType: 'labels.text.stroke',
    stylers: [{color: themeHex('map.ground')}],
  },
  // No pictograms anywhere — the location pins should be the only icons.
  {elementType: 'labels.icon', stylers: [{visibility: 'off'}]},

  // Buildings. Worth knowing before touching these two values: under
  // landscape.man_made, `geometry.fill` is the whole built-up *ground* (the town,
  // as one polygon) while `geometry.stroke` is what actually draws the individual
  // building footprints. So buildings read as outlines, not as filled shapes —
  // the fill stays a hair above the page color so the built-up area doesn't
  // become one bright slab, and the stroke carries all the contrast.
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.fill',
    stylers: [{color: MAP_RAMP.town}],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{color: MAP_RAMP.buildings}],
  },
  // A touch darker than the town, so the built-up edge is visible at low zoom.
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{color: MAP_RAMP.natural}],
  },

  // POI: keep the polygons, drop the names and pins.
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{color: MAP_RAMP.poi}],
  },
  {featureType: 'poi', elementType: 'labels', stylers: [{visibility: 'off'}]},
  // A hint of green so parks and sports grounds don't read as more buildings.
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{color: MAP_RAMP.park}],
  },
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  // Municipal boundaries and lot lines add lines without adding information.
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{visibility: 'off'}],
  },
  {featureType: 'administrative.land_parcel', stylers: [{visibility: 'off'}]},
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels',
    stylers: [{visibility: 'off'}],
  },

  // Roads carry their hierarchy through lightness alone — no casing strokes,
  // which is most of what makes a default map look busy.
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{color: MAP_RAMP.road}],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{visibility: 'off'}],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{color: MAP_RAMP.roadLabel}],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.fill',
    stylers: [{color: MAP_RAMP.roadLocal}],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.fill',
    stylers: [{color: MAP_RAMP.roadArterial}],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{color: MAP_RAMP.roadHighway}],
  },

  // Water sits below the ground plane rather than above it.
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{color: MAP_RAMP.water}],
  },
  {featureType: 'water', elementType: 'labels', stylers: [{visibility: 'off'}]},
];

// Matches the map div's background so tiles fade in from the page colour instead
// of flashing Google's default off-white.
export const mapBackground = (): string => themeHex('map.ground');
