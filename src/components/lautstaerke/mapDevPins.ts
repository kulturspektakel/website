import {useEffect, type MutableRefObject} from 'react';
import {pinIcon, pinLabel} from './mapPin';
import {pulseOverlay} from './mapPulse';

// Dev only: one sample per DisplayedLevel kind, so the pin variants can be
// compared side by side without waiting for a monitor to go quiet. Note that
// `live` and `history` deliberately look identical today — seeing that is half
// the point of having this.
const SAMPLE_PINS = [
  {kind: 'live', label: '88.4'},
  {kind: 'history', label: '62.5'},
  {kind: 'stale', label: '87.3'},
  {kind: 'none', label: ''},
];

// Renders the samples through exactly the same pinIcon/pinLabel/pulseOverlay the
// real pins use, rather than approximating them — otherwise the comparison is
// worthless. Kept anchored to the viewport on every idle so panning and zooming
// can't leave them off-screen; hover for the kind name.
//
// import.meta.env.DEV is statically false in a production build, so this whole
// body drops out.
export function useSamplePins(
  mapRef: MutableRefObject<google.maps.Map | null>,
): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const map = mapRef.current;
    if (!map) return;
    const maps = window.google.maps;

    const samples = SAMPLE_PINS.map(
      ({kind, label}) =>
        new maps.Marker({
          map,
          position: {lat: 0, lng: 0},
          title: `DEV — ${kind}`,
          label: pinLabel(label, kind === 'stale'),
          icon: pinIcon(maps, label !== '', kind === 'stale'),
          // Above the real pins, and never a drag target.
          zIndex: 1000,
          clickable: false,
        }),
    );

    // A row near the top of whatever is currently in view, evenly spaced.
    const place = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const lat = ne.lat() - (ne.lat() - sw.lat()) * 0.12;
      const span = ne.lng() - sw.lng();
      samples.forEach((marker, i) =>
        marker.setPosition({
          lat,
          lng: sw.lng() + (span * (i + 1)) / (samples.length + 1),
        }),
      );
    };
    // The live sample gets its pulse, so the dev row shows what live really looks
    // like rather than just its pill.
    const liveIndex = SAMPLE_PINS.findIndex((pin) => pin.kind === 'live');
    const pulse = new (pulseOverlay(maps))({lat: 0, lng: 0});
    pulse.setMap(map);
    const placeAll = () => {
      place();
      const at = samples[liveIndex]?.getPosition();
      if (at) pulse.setPosition({lat: at.lat(), lng: at.lng()});
    };
    placeAll();
    const listener = maps.event.addListener(map, 'idle', placeAll);

    return () => {
      listener.remove();
      pulse.setMap(null);
      for (const marker of samples) marker.setMap(null);
    };
  }, [mapRef]);
}
