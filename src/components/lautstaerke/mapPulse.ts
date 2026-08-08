// A ring expanding out from a pin, marking it as fed by the live stream.
//
// It has to be a DOM overlay rather than a marker: a marker's icon is an SVG
// Symbol the API rasterises, so it can't be animated without re-setting the icon
// every frame, and AdvancedMarkerElement (which *is* DOM) requires a mapId, which
// would disable the custom map style. OverlayView needs neither.
const PULSE_SIZE = 26;
// Green, matching the header's Live switch — "live" means the same thing in both
// places. A literal because this is plain DOM outside Chakra's provider; green.300
// rather than the switch's green.solid (green.600), because a 2px ring fading out
// to nothing needs to start well clear of the dark basemap.
const PULSE_STROKE = '#86efac';
const PULSE_PERIOD_MS = 2000;
// Two rings half a period apart, so there's always one on its way out rather than
// a gap between beats.
const PULSE_RINGS = 2;

type PulseCtor = new (position: google.maps.LatLngLiteral) => Pulse;
interface Pulse extends google.maps.OverlayView {
  setPosition(position: google.maps.LatLngLiteral): void;
}

// `google.maps` doesn't exist until the loader has run, so the subclass can't be
// declared at module scope. Built on first use and cached.
let pulseCtor: PulseCtor | null = null;

export function pulseOverlay(maps: typeof google.maps): PulseCtor {
  if (pulseCtor) return pulseCtor;
  pulseCtor = class extends maps.OverlayView implements Pulse {
    private div: HTMLDivElement | null = null;

    constructor(private position: google.maps.LatLngLiteral) {
      super();
    }

    setPosition(position: google.maps.LatLngLiteral) {
      this.position = position;
      this.draw();
    }

    onAdd() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      // The rings must never take a click meant for the map.
      div.style.pointerEvents = 'none';

      for (let i = 0; i < PULSE_RINGS; i++) {
        const ring = document.createElement('div');
        Object.assign(ring.style, {
          position: 'absolute',
          width: `${PULSE_SIZE}px`,
          height: `${PULSE_SIZE}px`,
          marginLeft: `${-PULSE_SIZE / 2}px`,
          marginTop: `${-PULSE_SIZE / 2}px`,
          borderRadius: '50%',
          border: `2px solid ${PULSE_STROKE}`,
        });
        // Web Animations rather than a CSS keyframe: nothing has to be injected
        // into the page's stylesheet, and transform/opacity animate off the main
        // thread — which matters because this runs continuously behind every live
        // pin. A negative delay starts each ring mid-flight instead of waiting.
        ring.animate(
          [
            {transform: 'scale(0.7)', opacity: 0.7},
            {transform: 'scale(2.4)', opacity: 0},
          ],
          {
            duration: PULSE_PERIOD_MS,
            iterations: Infinity,
            easing: 'ease-out',
            delay: (-PULSE_PERIOD_MS / PULSE_RINGS) * i,
          },
        );
        div.appendChild(ring);
      }

      this.div = div;
      // overlayLayer, not overlayMouseTarget: the ring must never take a click
      // meant for the map, which is how a location gets placed.
      this.getPanes()?.overlayLayer.appendChild(div);
    }

    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(
        new maps.LatLng(this.position),
      );
      if (!point || !this.div) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  };
  return pulseCtor;
}
