import {Wrapper} from '@googlemaps/react-wrapper';
import {Box, HStack, IconButton} from '@chakra-ui/react';
import {memo, useEffect, useRef, useState} from 'react';
import {LuPlus, LuX} from 'react-icons/lu';
import {SegmentedControl} from '../chakra-snippets/segmented-control';
import {Tooltip} from '../chakra-snippets/tooltip';
import {KULT_LOCATION} from '../../utils/kultLocation';
import {useLatest} from './chartUtils';
import {useDeviceStates, useTick} from './context';
import {
  displayedLevel,
  formatDb,
  isCurrent,
  loudestLevel,
  type LevelMetric,
} from './level';
import {type Weighting} from './noise';
import {darkMapStyle, mapBackground} from './mapStyle';
import {NO_LEVEL_LABEL, pinIcon, pinLabel} from './mapPin';
import {pulseOverlay} from './mapPulse';

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
  {value: 'roadmap', label: 'Map'},
  {value: 'hybrid', label: 'Satellite'},
];

/**
 * Every location of one noise project, on either the dark basemap or satellite
 * imagery.
 *
 * Placing a new one is a mode, not the map's default behaviour: the plus button arms
 * it, and only then does a click report a point via `onCreateAt`. The map is mostly
 * read — panning to a stage, reading a pin — and a surface where every stray click
 * opened a dialog made that reading nervous.
 */
// live/metric/weighting/history are the same four inputs the list rows get;
// displayedLevel turns them into a number.
type MapCanvasProps = {
  locations: MapLocation[];
  live: boolean;
  metric: LevelMetric;
  weighting: Weighting;
  history?: Record<string, number>;
  // Whether the create tool is armed. Owned by the caller, because what disarms it
  // is the dialog it opens closing again — which the map knows nothing about.
  placing?: boolean;
  onPlacingChange?: (placing: boolean) => void;
  // Where the map was clicked while armed. Absent for a map that may not be added
  // to, which also hides the plus button.
  onCreateAt?: (coordinates: Coordinates) => void;
  // Which pin was pressed. The map reports it and nothing more — where that leads is
  // the caller's business, and a component that draws pins has no view to send anyone
  // to. Absent leaves the pins unpressable.
  onSelect?: (locationId: string) => void;
};

function LocationsMap({apiKey, ...canvas}: MapCanvasProps & {apiKey: string}) {
  // Wrapper renders its children only once the Maps JS API has loaded, which is
  // what lets MapCanvas reach for window.google.maps directly. The key is the only
  // prop it consumes; everything else is the canvas's, passed through untouched.
  return (
    <Wrapper apiKey={apiKey}>
      <MapCanvas {...canvas} />
    </Wrapper>
  );
}

export default memo(LocationsMap);

function MapCanvas({
  locations,
  live,
  metric,
  weighting,
  history,
  placing = false,
  onPlacingChange,
  onCreateAt,
  onSelect,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  // An OverlayView that draws nothing, kept only for its projection: it is the
  // one way to turn a pin's lat/lng into a pixel inside the container, which is
  // where the tooltip has to be anchored.
  const projectionRef = useRef<google.maps.OverlayView | null>(null);
  // Which pin is hovered and where it sits, in container pixels. One tooltip for
  // the whole map rather than one per marker: a marker is drawn by the Maps API
  // and has no DOM node of its own to hang a trigger on.
  const [hovered, setHovered] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapTypeId, setMapTypeId] = useState<MapTypeId>('roadmap');

  // The map itself is created once. Rebuilding it on every project refetch would
  // reset the viewport and flash.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const maps = window.google.maps;
    mapRef.current = new maps.Map(containerRef.current, {
      styles: darkMapStyle(),
      backgroundColor: mapBackground(),
      // The map takes the whole view here, so a plain wheel scroll zooms rather
      // than asking for a modifier key first. On a viewport short enough that
      // the page scrolls, the map is still tall enough to scroll past.
      gestureHandling: 'greedy',
      streetViewControl: false,
      fullscreenControl: false,
      // Google's own map-type switcher is a light-themed widget that would sit
      // badly on this map; the segmented control below replaces it.
      mapTypeControl: false,
      // POI labels are styled off; this stops their invisible hitboxes from
      // swallowing clicks meant for the map.
      clickableIcons: false,
      center: {lat: KULT_LOCATION.latitude, lng: KULT_LOCATION.longitude},
      zoom: EMPTY_ZOOM,
    });
    const projection = new maps.OverlayView();
    projection.onAdd = () => {};
    projection.draw = () => {};
    projection.onRemove = () => {};
    projection.setMap(mapRef.current);
    projectionRef.current = projection;
  }, []);

  useEffect(() => {
    mapRef.current?.setOptions({
      mapTypeId,
      // The custom palette describes the roadmap base. Left applied over imagery
      // it would repaint the label overlay in mid-greys on a bright photo, so
      // hand labels back to Google's treatment, which is designed for satellite.
      styles: mapTypeId === 'roadmap' ? darkMapStyle() : [],
    });
  }, [mapTypeId]);

  // Armed: the pointer says the next click lands somewhere. Undefined puts it back
  // to Google's hand, which is what says the map is there to be moved around.
  useEffect(() => {
    mapRef.current?.setOptions({
      draggableCursor: placing ? 'crosshair' : undefined,
    });
  }, [placing]);

  // Click to place — and only while armed, so the listener is simply not registered
  // the rest of the time.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placing || !onCreateAt) return;
    const listener = map.addListener(
      'click',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onCreateAt({
          latitude: Number(e.latLng.lat().toFixed(COORD_DECIMALS)),
          longitude: Number(e.latLng.lng().toFixed(COORD_DECIMALS)),
        });
      },
    );
    return () => listener.remove();
  }, [placing, onCreateAt]);

  // The pointer stays over a marker while the world moves under it, so panning or
  // zooming fires no mouseout and the tooltip would hang at a stale pixel. On the
  // map itself, not per marker: the map outlives every marker rebuild.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dismiss = () => setHovered(null);
    const listeners = [
      map.addListener('dragstart', dismiss),
      map.addListener('zoom_changed', dismiss),
    ];
    return () => {
      for (const listener of listeners) listener.remove();
    };
  }, []);

  // Through a ref, because the markers are built once per set of locations and the
  // handler they close over would otherwise be the one from that render — a stale
  // navigate for as long as the pins stand.
  const selectRef = useLatest(onSelect);

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
    markersRef.current = locations.map((location) => {
      const marker = new maps.Marker({
        map,
        position: {lat: location.latitude, lng: location.longitude},
      });
      // The pin shows a level, not a name, so the name lives in a tooltip — a
      // Chakra one, driven from here. Deliberately no `title`: the native tooltip
      // would sit under the styled one on the same hover.
      marker.addListener('mouseover', () => {
        const point = projectionRef.current
          ?.getProjection()
          ?.fromLatLngToContainerPixel(
            new maps.LatLng({lat: location.latitude, lng: location.longitude}),
          );
        if (!point) return;
        setHovered({
          id: location.id,
          name: location.locationName,
          x: point.x,
          y: point.y,
        });
      });
      marker.addListener('mouseout', () => setHovered(null));
      // The pin is the way to the place: pressing one asks for that stage's readings,
      // which the map can only show as a number in a badge. While the create tool is
      // armed no pin is clickable at all, so this cannot fire then — the click goes to
      // the map underneath, which is where an armed one belongs.
      marker.addListener('click', () => selectRef.current?.(location.id));
      return marker;
    });

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

  // Armed, the pins step out of the way: a marker swallows the click that lands on it, so
  // leaving them clickable would make the one spot you most want a second mic at — beside
  // the first — the one spot you cannot drop it. Unclickable they pass it down to the map,
  // and they carry the crosshair while they do, since the pointer they'd otherwise show
  // promises a navigation that isn't going to happen.
  //
  // `signature` is a dependency because the markers are rebuilt on it, and a set built
  // while armed would arrive clickable.
  useEffect(() => {
    for (const marker of markersRef.current) {
      marker.setOptions({
        clickable: !placing,
        cursor: placing ? 'crosshair' : undefined,
      });
    }
    // An unclickable marker fires no mouseout either, so a tooltip open at the moment the
    // tool was armed would hang there for good. Dismissed here rather than by the pin,
    // which has just stopped being able to say anything.
    if (placing) setHovered(null);
  }, [placing, signature]);

  // The level each pin shows, decided by the same function the list rows use. Every
  // pin is redrawn together, so one subscription across the monitors actually on the
  // map — and none for the ones that aren't.
  const deviceState = useDeviceStates(
    locations.flatMap((location) => location.deviceIds),
  );
  // Live records arrive ~1/s; without a tick the pins would freeze at whatever
  // value happened to be current when the markers were built.
  const now = useTick();
  const pinLevels = locations.map((location) =>
    loudestLevel(
      location.deviceIds.map((deviceId) =>
        displayedLevel({
          live,
          now,
          metric,
          weighting,
          state: deviceState(deviceId),
          historyDb: history?.[deviceId],
        }),
      ),
    ),
  );
  const pinLabels = pinLevels.map((level) =>
    level.kind === 'none' ? NO_LEVEL_LABEL : formatDb(level.db),
  );
  // Greyed down for anything that isn't a reading of the instant being viewed — a
  // number we only remember, or none at all — the same way the list rows grey theirs.
  // The two cases look alike on purpose: from across the map both mean "not this".
  const pinStale = pinLevels.map((level) => !isCurrent(level));

  // Two effects, because the two change at very different rates: the number moves
  // roughly once a second per monitor, while the pin's *badge* only changes when a
  // location stops (or starts) reading now. Rebuilding an icon object per marker per
  // second would be pure churn.
  const labelKey = pinLabels.join('|');
  const staleKey = pinStale.map((stale) => (stale ? '1' : '0')).join('');
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      marker.setLabel(
        pinLabel(pinLabels[i] ?? NO_LEVEL_LABEL, pinStale[i] ?? true),
      );
    });
  }, [labelKey, staleKey, signature]);

  useEffect(() => {
    if (!mapRef.current) return;
    const maps = window.google.maps;
    const pill = pinIcon(maps);
    const stalePill = pinIcon(maps, true);
    markersRef.current.forEach((marker, i) => {
      marker.setIcon(pinStale[i] ? stalePill : pill);
    });
  }, [staleKey, signature]);

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

  // Drop every marker when the page unmounts; the map goes with the container.
  useEffect(
    () => () => {
      for (const marker of markersRef.current) marker.setMap(null);
      markersRef.current = [];
    },
    [],
  );

  // One string for the plus button's accessible name and its tooltip: they say the
  // same thing to a screen reader and to a pointer, and two that drifted apart is
  // exactly the sort of thing nobody notices.
  const placeLabel = placing ? 'Cancel placing a location' : 'Add location';

  // Fills its nearest positioned ancestor rather than taking a percentage height,
  // so it works the same whether the caller sizes the box explicitly or lets flex
  // do it. The caller must set position="relative".
  return (
    <Box position="absolute" inset="0">
      <div ref={containerRef} style={{height: '100%', width: '100%'}} />
      {/* The tooltip's trigger. A marker is drawn by the Maps API and owns no DOM
          node, so the anchor is this zero-size box parked at the pin's pixel and
          the open state is driven by the marker's own hover events. Keyed on the
          location so moving between two pins re-anchors rather than leaving the
          bubble where the last one was. */}
      {hovered && (
        <Tooltip
          key={hovered.id}
          open
          content={hovered.name}
          positioning={{placement: 'top'}}
          showArrow
        >
          <Box
            position="absolute"
            left={`${hovered.x}px`}
            top={`${hovered.y}px`}
            // The pill is 26px tall and centred on the point, so lifting the
            // anchor by half of it puts the bubble above the badge, not over it.
            mt="-13px"
            boxSize="0"
            pointerEvents="none"
          />
        </Tooltip>
      )}
      {/* A sibling of the map container rather than a Google control, so it's
          styled like the rest of the page and swallows its own clicks instead of
          letting them through as a "create here" tap. */}
      <HStack position="absolute" top="2" right="2" zIndex="1" gap="2">
        {/* No colour overrides: recolouring only the track leaves the unselected
            label in the theme's dark `fg`, which on a dark track is unreadable.
            The theme's own track is opaque, so it reads over roadmap and
            satellite alike; the shadow is what lifts it off the map. */}
        <SegmentedControl
          size="xs"
          shadow="md"
          value={mapTypeId}
          onValueChange={(e) => setMapTypeId(e.value as MapTypeId)}
          items={MAP_TYPES}
        />
        {onCreateAt && (
          // The same words as the accessible name, in a Chakra tooltip like the
          // pins' — and no `title`, or the native one would show up beside it.
          <Tooltip
            content={placeLabel}
            showArrow
            positioning={{placement: 'bottom'}}
          >
            {/* A toggle, and it says so: armed it is solid and its icon turns from
                "add" into "cancel", so the mode is visible from the button as well
                as from the cursor — which a touch device doesn't have.

                Lit in the accent rather than in green: green on this page means a
                monitor is reporting (see LiveStatusDot and the map's own pulse
                rings), and being armed to drop a pin is a mode this control is in,
                not something the site is doing. */}
            <IconButton
              aria-label={placeLabel}
              size="xs"
              shadow="md"
              variant={placing ? 'solid' : 'surface'}
              colorPalette={placing ? 'accent' : undefined}
              onClick={() => onPlacingChange?.(!placing)}
            >
              {placing ? <LuX /> : <LuPlus />}
            </IconButton>
          </Tooltip>
        )}
      </HStack>
    </Box>
  );
}
