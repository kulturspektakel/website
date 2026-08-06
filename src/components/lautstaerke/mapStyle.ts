// A dark, deliberately quiet basemap for the noise-project overview.
//
// Colors are the same Chakra grays the crew UI is built from (gray.900 for the
// page, gray.800 for raised surfaces, gray.700 for borders, gray.400/500 for
// text), so the map reads as part of the page rather than an embedded widget.
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
export const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  // Ground plane and label defaults; the stroke is a halo in the ground color so
  // text stays legible wherever it lands.
  {elementType: 'geometry', stylers: [{color: '#18181b'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#a1a1aa'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#18181b'}]},
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
    stylers: [{color: '#202024'}],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    // Bright for a gray this dark, on purpose: the footprint outline is a
    // hairline, so it needs the contrast to survive antialiasing.
    stylers: [{color: '#7c7c88'}],
  },
  // A touch darker than the town, so the built-up edge is visible at low zoom.
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{color: '#17171a'}],
  },

  // POI: keep the polygons, drop the names and pins.
  {featureType: 'poi', elementType: 'geometry', stylers: [{color: '#26262b'}]},
  {featureType: 'poi', elementType: 'labels', stylers: [{visibility: 'off'}]},
  // A hint of green so parks and sports grounds don't read as more buildings.
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{color: '#1e2620'}],
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
    stylers: [{color: '#2e2e33'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{visibility: 'off'}],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{color: '#8a8a94'}],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.fill',
    stylers: [{color: '#33333a'}],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.fill',
    stylers: [{color: '#41414a'}],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{color: '#52525b'}],
  },

  // Water sits below the ground plane rather than above it.
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#0d0d10'}]},
  {featureType: 'water', elementType: 'labels', stylers: [{visibility: 'off'}]},
];

// Matches the map div's background so tiles fade in from the page color instead
// of flashing Google's default off-white.
export const MAP_BACKGROUND = '#18181b';
