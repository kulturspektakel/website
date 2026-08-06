import {Wrapper} from '@googlemaps/react-wrapper';
import {Box} from '@chakra-ui/react';
import {memo, useEffect, useRef, useState} from 'react';
import {SegmentedControl} from '../chakra-snippets/segmented-control';
import {KULT_LOCATION} from '../../utils/kultLocation';
import {useNoiseLive, useTick} from './context';
import {displayedLevel, formatDb, loudestLevel} from './level';
import {DARK_MAP_STYLE, MAP_BACKGROUND} from './mapStyle';
import {pinIcon, pinLabel} from './mapPin';
import {pulseOverlay} from './mapPulse';
import {useSamplePins} from './mapDevPins';

export type MapLocation = {
  id: string;
  locationName: string;
  latitude: number;
  longitude: number;
  // The monitors standing here, whose loudest level the pin carries.
  deviceIds: string[];
};

export type Coordinates = {latitude: number; longitude: number};

// Two mics twenty metres apart would otherwise make fitBounds zoom to the max.
const MAX_FIT_ZOOM = 18;
const SINGLE_LOCATION_ZOOM = 17;
// A project with no locations yet still gets a map to click on, framed on the
// festival site — the only sensible guess, since NoiseProject has no coordinates.
const EMPTY_ZOOM = 16;
// ~0.1 m. Full click precision is a dozen meaningless digits in a form field.
const COORD_DECIMALS = 6;

// 'hybrid' rather than 'satellite' for the imagery view: it keeps the road and
// label overlay, and a mic gets placed relative to a named street or building as
// often as to something only visible from above. String literals because the
// google.maps.MapTypeId enum doesn't exist until the API has loaded.
type MapTypeId = 'roadmap' | 'hybrid';
const MAP_TYPES: Array<{value: MapTypeId; label: string}> = [
  {value: 'roadmap', label: 'Karte'},
  {value: 'hybrid', label: 'Satellit'},
];

/**
 * Every location of one noise project, on either the dark basemap or satellite
 * imagery. Clicking the map reports the clicked point via `onCreateAt`, which is
 * how new locations get placed.
 */
function LocationsMap({
  apiKey,
  locations,
  live,
  history,
  onCreateAt,
}: {
  apiKey: string;
  locations: MapLocation[];
  // Same two inputs the list rows get; displayedLevel turns them into the number.
  live: boolean;
  history?: Record<string, number>;
  onCreateAt?: (coordinates: Coordinates) => void;
}) {
  // Wrapper renders its children only once the Maps JS API has loaded, which is
  // what lets MapCanvas reach for window.google.maps directly.
  return (
    <Wrapper apiKey={apiKey}>
      <MapCanvas
        locations={locations}
        live={live}
        history={history}
        onCreateAt={onCreateAt}
      />
    </Wrapper>
  );
}

export default memo(LocationsMap);

function MapCanvas({
  locations,
  live,
  history,
  onCreateAt,
}: {
  locations: MapLocation[];
  live: boolean;
  history?: Record<string, number>;
  onCreateAt?: (coordinates: Coordinates) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapTypeId, setMapTypeId] = useState<MapTypeId>('roadmap');

  // The map itself is created once. Rebuilding it on every project refetch would
  // reset the viewport and flash.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const maps = window.google.maps;
    mapRef.current = new maps.Map(containerRef.current, {
      styles: DARK_MAP_STYLE,
      backgroundColor: MAP_BACKGROUND,
      // The page scrolls, so a plain wheel scroll must not get captured.
      gestureHandling: 'cooperative',
      streetViewControl: false,
      fullscreenControl: false,
      // Google's own map-type switcher is a light-themed widget that would sit
      // badly on this map; the segmented control below replaces it.
      mapTypeControl: false,
      // POI labels are styled off; this stops their invisible hitboxes from
      // swallowing clicks meant for the map.
      clickableIcons: false,
      // Signals that the surface itself is the control.
      draggableCursor: 'crosshair',
      center: {lat: KULT_LOCATION.latitude, lng: KULT_LOCATION.longitude},
      zoom: EMPTY_ZOOM,
    });
  }, []);

  useEffect(() => {
    mapRef.current?.setOptions({
      mapTypeId,
      // The custom palette describes the roadmap base. Left applied over imagery
      // it would repaint the label overlay in mid-greys on a bright photo, so
      // hand labels back to Google's treatment, which is designed for satellite.
      styles: mapTypeId === 'roadmap' ? DARK_MAP_STYLE : [],
    });
  }, [mapTypeId]);

  // Click to place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onCreateAt?.({
        latitude: Number(e.latLng.lat().toFixed(COORD_DECIMALS)),
        longitude: Number(e.latLng.lng().toFixed(COORD_DECIMALS)),
      });
    });
    return () => listener.remove();
  }, [onCreateAt]);

  // Markers and viewport follow the data — but only when the data actually
  // changed. Refetching after an assignment hands back an equal-but-new array,
  // and re-fitting on that would throw away any panning the user just did.
  const signature = locations
    .map((l) => `${l.id}@${l.latitude},${l.longitude}:${l.locationName}`)
    .join('|');

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const maps = window.google.maps;
    // `locations` is captured from the same render that produced `signature`, so
    // reading it here can't go stale.
    for (const marker of markersRef.current) marker.setMap(null);
    markersRef.current = locations.map(
      (location) =>
        new maps.Marker({
          map,
          position: {lat: location.latitude, lng: location.longitude},
          // The pin shows a level, not a name, so the name lives in the tooltip.
          title: location.locationName,
        }),
    );

    // Nothing to frame yet: leave the festival-site view the map opened with.
    if (locations.length === 0) return;

    if (locations.length === 1) {
      const only = locations[0]!;
      map.setCenter({lat: only.latitude, lng: only.longitude});
      map.setZoom(SINGLE_LOCATION_ZOOM);
      return;
    }

    const bounds = new maps.LatLngBounds();
    for (const location of locations) {
      bounds.extend({lat: location.latitude, lng: location.longitude});
    }
    // Padding keeps pins off the edges, where the label would be clipped.
    map.fitBounds(bounds, 48);
    // fitBounds resolves asynchronously, so the clamp has to wait for it.
    const clamp = maps.event.addListenerOnce(map, 'idle', () => {
      const zoom = map.getZoom();
      if (zoom != null && zoom > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
    });
    return () => clamp.remove();
  }, [signature]);

  // The level each pin shows, decided by the same function the list rows use.
  const ctx = useNoiseLive();
  // Live records arrive ~1/s; without a tick the pins would freeze at whatever
  // value happened to be current when the markers were built.
  const now = useTick();
  const pinLevels = locations.map((location) =>
    loudestLevel(
      location.deviceIds.map((deviceId) =>
        displayedLevel({
          live,
          now,
          state: ctx.devices[deviceId],
          historyDb: history?.[deviceId],
        }),
      ),
    ),
  );
  const pinLabels = pinLevels.map((level) =>
    level.kind === 'none' ? '' : formatDb(level.db),
  );

  // Two effects, because the two change at very different rates: the number moves
  // roughly once a second per monitor, while the pin's *shape* only flips when a
  // level appears or disappears. Rebuilding an icon object per marker per second
  // would be pure churn.
  const labelKey = pinLabels.join('|');
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      const text = pinLabels[i] ?? '';
      marker.setLabel(pinLabel(text));
    });
  }, [labelKey, signature]);

  // '1' where the pin has a number to carry, '0' where it's a bare dot.
  const shapeKey = pinLabels.map((text) => (text ? '1' : '0')).join('');
  useEffect(() => {
    if (!mapRef.current) return;
    const maps = window.google.maps;
    const pill = pinIcon(maps, true);
    const dot = pinIcon(maps, false);
    markersRef.current.forEach((marker, i) => {
      marker.setIcon(pinLabels[i] ? pill : dot);
    });
  }, [shapeKey, signature]);

  // A pulse behind every pin currently fed by the live stream. Keyed on which pins
  // those are, so it only churns when liveness actually changes — not on every
  // level update.
  const liveKey = pinLevels
    .map((level) => (level.kind === 'live' ? '1' : '0'))
    .join('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const Pulse = pulseOverlay(window.google.maps);
    const pulses = locations.flatMap((location, i) =>
      pinLevels[i]?.kind === 'live'
        ? [new Pulse({lat: location.latitude, lng: location.longitude})]
        : [],
    );
    for (const pulse of pulses) pulse.setMap(map);
    return () => {
      for (const pulse of pulses) pulse.setMap(null);
    };
  }, [liveKey, signature]);

  useSamplePins(mapRef);

  // Drop every marker when the page unmounts; the map goes with the container.
  useEffect(
    () => () => {
      for (const marker of markersRef.current) marker.setMap(null);
      markersRef.current = [];
    },
    [],
  );

  // Fills its nearest positioned ancestor rather than taking a percentage height,
  // so it works the same whether the caller sizes the box explicitly or lets flex
  // do it. The caller must set position="relative".
  return (
    <Box position="absolute" inset="0">
      <div ref={containerRef} style={{height: '100%', width: '100%'}} />
      {/* A sibling of the map container rather than a Google control, so it's
          styled like the rest of the page and swallows its own clicks instead of
          letting them through as a "create here" tap. */}
      <Box position="absolute" top="2" right="2" zIndex="1">
        <SegmentedControl
          size="xs"
          bg="gray.900"
          borderWidth="1px"
          borderColor="gray.700"
          value={mapTypeId}
          onValueChange={(e) => setMapTypeId(e.value as MapTypeId)}
          items={MAP_TYPES}
        />
      </Box>
    </Box>
  );
}
