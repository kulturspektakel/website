import {bandFill} from './pinScale';

// A soft halo under a pin, in the colour that pin's level put on it.
//
// What it is for is the map read from a distance, which is how this map is mostly read: the
// pills are small and far apart, and their fills — six steps of a ramp on a dark basemap —
// are a few dozen pixels of colour each. The halo spreads that colour over enough ground to
// be seen without being read, so a site's shape ("the two stages at the north end are in
// the top band, everything else is cool") arrives before any number does. Under the badge
// rather than around it, so what it spreads is the pin's own answer and not a second one.
//
// A DOM overlay for the same reason the pulse is one (see mapPulse): a marker's icon is an
// SVG Symbol the API rasterises, so a gradient this soft would be a bitmap re-set on every
// change, and AdvancedMarkerElement — which is DOM — needs a mapId, which would throw away
// the custom map style.
//
/**
 * How wide the wash is: how loud, and how far away the ground is.
 *
 * Both, because a halo that answered only one of them would be lying about the other. A
 * fixed pixel size says the same thing at the zoom where the whole site fits and at the one
 * where a single stage does — which makes it a decoration of the pin rather than a
 * statement about the place. And a size that ignored the level would spend the map's
 * largest mark on saying nothing the colour hadn't already said.
 *
 * So the halo is a distance on the ground, and the distance is read off the level: every
 * DOUBLING_DB the reach doubles. That is the shape of the real thing — sound falls off with
 * distance, so a louder source is heard further out — but the rate is chosen to look right
 * on a festival site rather than derived. Free-field spreading alone is 6 dB per doubling,
 * which across the fifty decibels a site actually spans is a factor of three hundred: the
 * quiet measuring point would be a dot and the main stage would cover the county. Twenty is
 * the rate at which both of them are legible on one screen. It is an illustration of reach,
 * not a propagation model — no barriers, no ground effect, no wind — and the comparison it
 * supports is between two pins on this map, not against a number in a permit.
 *
 * Clamped at both ends in pixels, which is where the honesty of a distance runs out. Zoomed
 * far in, a stage's reach is off the screen in every direction and a wash covering the whole
 * map says less than a smaller one; zoomed far out, it is a couple of pixels and the pin has
 * no glow at all. The clamp is a floor and a ceiling on legibility, and inside them the
 * scale is the real one.
 */
// Tuned at the zooms a site is actually read at — 16 and 17, where the whole festival or one
// end of it fits — so that the ramp's full span lands between the clamps there and only runs
// into them further in or further out.
const GLOW_REF_DB = 60;
const GLOW_REF_METRES = 55;
const GLOW_DOUBLING_DB = 20;
const GLOW_MIN_RADIUS = 32;
const GLOW_MAX_RADIUS = 280;

// The div is built at the largest the halo is ever drawn and scaled down with a transform,
// rather than resized. Width and height are layout; a transform is not, so a zoom gesture
// moves a compositor property on a handful of elements instead of reflowing them — and the
// gradient inside is re-rasterised by the compositor rather than recomputed per step.
const GLOW_SIZE = GLOW_MAX_RADIUS * 2;

// Web Mercator, at the latitude the halo stands: the equator's metres-per-pixel at zoom 0,
// narrowed by the cosine as the projection stretches towards the poles. Every map library
// carries this constant; it is the equatorial circumference over the 256px world tile.
const EQUATOR_METRES_PER_PIXEL = 156543.03392;

const metresPerPixel = (latitude: number, zoom: number): number =>
  (EQUATOR_METRES_PER_PIXEL * Math.cos((latitude * Math.PI) / 180)) /
  Math.pow(2, zoom);

// What the level reaches, in metres — the whole of the value half of the scale.
const reachMetres = (db: number): number =>
  GLOW_REF_METRES * Math.pow(2, (db - GLOW_REF_DB) / GLOW_DOUBLING_DB);

// And that reach on this screen, in pixels, held between the two legibility bounds.
const radiusPixels = (db: number, latitude: number, zoom: number): number => {
  const pixels = reachMetres(db) / metresPerPixel(latitude, zoom);
  return Math.min(GLOW_MAX_RADIUS, Math.max(GLOW_MIN_RADIUS, pixels));
};

// The centre's opacity. Alpha is written into the colour rather than set on the element, so
// the gradient interpolates between two alphas of one hue instead of towards a transparent
// black that greys the middle of the ramp on the way down.
const GLOW_ALPHA = 0.3;

/**
 * The falloff, as the stops of the gradient — a Gaussian, sampled.
 *
 * A browser interpolates *linearly* between gradient stops, so a handful of them is a
 * handful of straight lines, and every joint between two of them is a crease the eye finds:
 * a halo written as "30% at the middle, 15% here, nothing there" ends in a visible ring at
 * the last stop, which is a hard edge however soft the colours either side of it are. The
 * fix is not a colour space — interpolating in oklab moves the *hue* between two colours,
 * and this gradient has one hue and only ever varies its alpha — but the shape of the curve
 * those stops describe.
 *
 * So: a Gaussian, which is what an out-of-focus point of light actually is, sampled finely
 * enough that the straight lines between samples are shorter than the eye's tolerance for
 * them. Normalised to reach exactly zero at the rim rather than to trail off just above it,
 * because "just above zero" cut off at the edge of a div is the very ring this exists to
 * avoid.
 *
 * SPREAD is how much of the radius the light occupies: bigger is a broader, flatter wash. At
 * this value the halo has faded to a tenth of its centre by half the radius, which is why
 * GLOW_SIZE above is about twice the wash anyone will say they can see.
 */
const GLOW_SPREAD = 5.5;
// Enough samples that no two are more than a couple of per cent of alpha apart, and few
// enough that the string stays a string. Twelve segments is the knee of that trade.
const GLOW_STOPS = 12;

const falloff = (t: number): number => {
  const tail = Math.exp(-GLOW_SPREAD);
  return (GLOW_ALPHA * (Math.exp(-GLOW_SPREAD * t * t) - tail)) / (1 - tail);
};

// Two hex digits of alpha, which is what an 8-digit colour takes. Rounded rather than
// floored so the centre stop lands on the intended value exactly.
const alphaHex = (alpha: number): string =>
  Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');

// The offsets are the same for every pin, so only the hex in front of them changes. Built
// once as a list of `${offset}` / `${alpha}` pairs and joined per colour.
const GLOW_CURVE = Array.from({length: GLOW_STOPS + 1}, (_, i) => {
  const t = i / GLOW_STOPS;
  return {stop: `${Math.round(t * 100)}%`, alpha: alphaHex(falloff(t))};
});

/**
 * How the wash is composited onto whatever is under it — which has to be two answers,
 * because this map has two grounds.
 *
 * On the dark basemap, `screen`: the halo is light added rather than paint laid over, so
 * what is under it stays visible through it and two overlapping halos sum the way two lamps
 * would rather than the nearer one veiling the further.
 *
 * Over the ground itself this changes almost nothing, and that is arithmetic rather than
 * disappointment: the ground is near-black, and screening onto black *is* plain
 * compositing. Where it shows is everything on the map that isn't the ground — the roads,
 * the water, a crop of parkland, the next halo along — which is exactly where a wash laid
 * over the top was dulling something that had been drawn on purpose.
 *
 * Over satellite imagery, `multiply`: the ground there is bright and detailed, and light
 * added to it is light lost — a screened wash over a sunlit field is a slightly paler
 * sunlit field. Multiplied, the same colour tints what is underneath the way a highlighter
 * does, and the imagery keeps its detail through it.
 *
 * Both are the same decision mapStyle makes and for the same reason: the palette describes
 * the roadmap, and imagery is somebody else's photograph.
 */
export type GlowBlend = 'screen' | 'multiply';

// `closest-side`, and it is load-bearing. A radial gradient sizes itself to the *farthest
// corner* by default, so in a square box its 100% lands on the half-diagonal — a fifth again
// beyond the sides. The box is a circle, so everything past the sides is clipped away, and
// what gets clipped is the curve at about 2% alpha: a hard round edge, drawn exactly where
// the fade was supposed to have finished. Sized to the near side instead, the curve reaches
// zero at the rim and there is nothing left at the boundary to cut.
const glowGradient = (hex: string): string =>
  `radial-gradient(circle closest-side, ${GLOW_CURVE.map(
    ({stop, alpha}) => `${hex}${alpha} ${stop}`,
  ).join(', ')})`;

type GlowCtor = new (
  position: google.maps.LatLngLiteral,
  blend: GlowBlend,
) => Glow;
export interface Glow extends google.maps.OverlayView {
  // The level this halo stands for, or null for a pin with nothing current to say — which
  // draws no halo at all rather than a grey one (see LocationsMap).
  //
  // A setter rather than a constructor argument, and that is the whole reason this overlay
  // has an interface: live levels arrive about once a second, and rebuilding a div, its
  // gradient and its pane insertion at that rate — for every pin on the map — to change a
  // colour and a scale factor would be a great deal of work to produce the same element
  // again. Set on the one that is already standing there, both are property writes.
  setLevel(db: number | null): void;
}

// `google.maps` doesn't exist until the loader has run, so the subclass can't be declared at
// module scope. Built on first use and cached.
let glowCtor: GlowCtor | null = null;

export function glowOverlay(maps: typeof google.maps): GlowCtor {
  if (glowCtor) return glowCtor;
  glowCtor = class extends maps.OverlayView implements Glow {
    private div: HTMLDivElement | null = null;
    private db: number | null = null;
    // What was last written to the element, so a pan — which calls draw() on every frame —
    // and a level that moved a tenth of a decibel both cost a comparison rather than a
    // style write. The zoom is the other half of that: it is read per draw because there is
    // no event for "the zoom finished changing" that fires before the overlay is redrawn.
    private appliedColor: string | null = null;
    private appliedScale: number | null = null;

    constructor(
      private position: google.maps.LatLngLiteral,
      private blend: GlowBlend,
    ) {
      super();
    }

    setLevel(db: number | null) {
      if (db === this.db) return;
      this.db = db;
      this.apply();
    }

    onAdd() {
      const div = document.createElement('div');
      Object.assign(div.style, {
        position: 'absolute',
        width: `${GLOW_SIZE}px`,
        height: `${GLOW_SIZE}px`,
        marginLeft: `${-GLOW_SIZE / 2}px`,
        marginTop: `${-GLOW_SIZE / 2}px`,
        // No border-radius: the shape is the falloff's, and it is already nothing at the
        // sides. A circular clip would be a second edge sitting on top of a fade that has
        // finished — which is the very thing that used to draw a ring here.
        //
        // Blending reaches as far as the nearest ancestor that makes a stacking context, and
        // the Maps API transforms the container its panes live in — so what this actually
        // blends with is the other overlays in that container, and possibly the tiles behind
        // it, depending on how the API has arranged itself today. Overlapping halos
        // combining properly is worth having on its own, and where it does reach the basemap
        // it is the whole of what makes the tail read as light rather than as film. Worth a
        // look in the browser after a Maps release: the tell is whether a road under a halo
        // brightens.
        mixBlendMode: this.blend,
        // It must never take a click meant for the map, which is how a location gets placed
        // — and it is the width of a small building on screen, so it would take a great many
        // of them.
        pointerEvents: 'none',
      });
      this.div = div;
      // overlayLayer, and under the pins: this is the pin's colour spread out, so anything
      // that has something to say — the badge, its warning — stays on top of it. The pane is
      // also the one that takes no pointer events at all, which is the same rule again
      // enforced by where it lives rather than only by the style above.
      this.getPanes()?.overlayLayer.appendChild(div);
      this.apply();
    }

    // The colour and the size, written only where they have actually moved. Called on a new
    // level and on every draw, since a draw is also how a zoom arrives.
    private apply() {
      const div = this.div;
      if (!div) return;
      if (this.db == null) {
        div.style.display = 'none';
        return;
      }
      div.style.display = '';

      // The very colour the pin is filled with, off the same lookup — the halo is that pin's
      // answer spread out, so a second rule for its hue would be a second answer.
      const color = bandFill(this.db);
      if (color !== this.appliedColor) {
        div.style.background = glowGradient(color);
        this.appliedColor = color;
      }

      const zoom = this.getMap()?.getZoom();
      if (zoom == null) return;
      const radius = radiusPixels(this.db, this.position.lat, zoom);
      // Rounded before comparing, so a pinch that moves the zoom by a thousandth doesn't
      // write a transform that renders identically.
      const scale = Math.round((radius / GLOW_MAX_RADIUS) * 100) / 100;
      if (scale !== this.appliedScale) {
        div.style.transform = `scale(${scale})`;
        this.appliedScale = scale;
      }
    }

    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(
        new maps.LatLng(this.position),
      );
      if (!point || !this.div) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
      // A zoom is a draw, and the halo's size is a fact about the zoom.
      this.apply();
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
      this.appliedColor = null;
      this.appliedScale = null;
    }
  };
  return glowCtor;
}
