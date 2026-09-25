import {defaultConfig} from '@chakra-ui/react';

// The colour vocabulary of /crew/noise, in the one place that decides it.
//
// The section's *page* renders dark — crew.noise.tsx wraps the layout in
// <Theme appearance="dark"> — so everything here is a dark-only decision and none
// of it carries a light half. That is also why the two *overrides* the section
// needs (the page ground and the focus ring) live in theme-crew.ts as `_dark`
// values rather than here: the dark half of a crew token is, by construction, the
// noise area's value. If /crew ever goes dark somewhere else that stops being
// true, and the fix is a custom condition — `conditions: {noise: '.noise &'}` on
// the system, `_noise` on those two tokens, and the class on that wrapper.
//
// "Page", not "area", is the load-bearing word: the overlays Chakra portals to
// <body> land outside that scope and render light, so anything reaching for a name
// from here has to be inside the page. The two floating panels are the exception
// and wrap themselves in <Theme appearance="dark"> to earn it.
//
// Everything below is a *new* name rather than an override, so it needs no
// scoping at all: nothing outside this section refers to `chart.*` or `map.*`,
// and `accent` is only ever asked for by name.

// One literal table: a token path against the Chakra scale step it stands for —
// or, where the two appearances need different steps, against one for each.
// Every other export is derived from it, so recolouring anything is one edit
// here rather than an edit here and a matching one in the canvas layer.
//
// Almost every entry is a bare step, because almost every entry is only ever
// drawn on the section's dark page. The pairs are the tokens the calibration
// chart reaches for, which is the one thing here rendered on a light ground —
// its panel is portalled and no longer re-establishes the dark scope (see
// ReferenceMicPanel). A pair costs the CSS side nothing: `nest` below emits it
// as a condition, so a Chakra consumer follows whatever appearance it is under
// without being told. The canvas is what has to be told (see themeHex).
//
// Keys are spelled the way they will read as CSS variables. Chakra formats a
// var name by joining the path with `-` and then dash-casing it, which means
// camelCase gains a separator (`eqFast` → `eq-fast`) while an underscore is
// passed through untouched. `eqFast` and `eq-fast` therefore collide silently.
const NOISE_COLORS = {
  // Every chart series, in one shade: the section's accent. It used to be a
  // yellow → orange → red ramp, a shade per kind, but the project page picks one
  // series at a time and its name is printed beside every number, so the ramp
  // was colour saying what the label already said. Where several lines are
  // drawn at once (the device page), the tooltip names each.
  'chart.series': 'yellow.400',

  // Chart chrome. `rule` is the hairline the readout pills are outlined in and
  // the project timeline draws its ticks with — one step lighter than
  // `border.emphasized`, which is what it needs to be to stay visible both over
  // the toolbar and inside the 15% accent wash of a crop window.
  'chart.axis': {_light: 'gray.600', _dark: 'gray.400'},
  'chart.grid': {_light: 'gray.300', _dark: 'gray.700'},
  'chart.rule': {_light: 'gray.300', _dark: 'gray.600'},
  // The hatch the project timeline shades a stretch with no readings in (see
  // TimelineMarkers). Its own name, because unlike every other entry here it is not drawn
  // as a line but as texture: the stripes cover about a third of the band, so what the eye
  // gets is their average against the ground behind rather than this value itself. Which
  // means the step alone does not say how heavy the shading is — it is this and the pitch
  // over in TimelineMarkers together, and they have to be changed as a pair.
  //
  // It lands on `grid`'s step, and that is a coincidence of value rather than a
  // relationship: one is the faintest line a chart can be read against, this is the
  // faintest texture a strip can be. Neither has a reason to follow the other, so they
  // stay two names. This is meant to be read past — a missing stretch should be findable
  // at a glance without becoming the loudest thing on a strip whose subject is the crop.
  'chart.gap': 'gray.700',
  // The limit rules over the level trace. Red, off the series' yellow, so a rule stays
  // legible where the trace runs along or across it — in the series' own shade the two
  // merged exactly where a limit matters. Still dashed, so the hue is not the only cue.
  'chart.limit': 'red.500',
  // One colour per monitor, for a location that has had several: each gets its own line
  // (see deviceColors). The first is the series shade, so the ordinary one-monitor chart and
  // the first monitor of several look the same; the rest are picked to stay apart from it
  // and from each other on the dark ground, and from the limit's red.
  'chart.device.1': 'yellow.400',
  'chart.device.2': 'cyan.400',
  'chart.device.3': 'pink.400',
  'chart.device.4': 'green.400',
  'chart.device.5': 'purple.400',
  'chart.device.6': 'orange.300',
  // A stretch crew tagged to be ignored, washed under the trace (see drawTags). Grey, so
  // it reads as "set aside" rather than as another mark competing with the red rules.
  'chart.ignored': 'gray.500',
  'chart.playhead': 'gray.50',
  'chart.readout.bg': {_light: 'gray.50', _dark: 'gray.800'},

  // The band spectrum's bars are the fast-window shade — it is the same
  // measurement, drawn against frequency instead of time.
  //
  // Its light half is off the ramp entirely, because in light the section's colour is
  // blue rather than yellow (see the accent block below) — and it is the *same* blue,
  // `blue.solid`, which is what a primary button is filled with. 5.17:1 on white, so it
  // clears the 3:1 a bar has to and the 4.5:1 the same token has to as 12 px type in the
  // readout beside it. No yellow step does both: yellow.600 is 2.94:1, and the ones that
  // pass are browns.
  'chart.band.bar': {_light: 'blue.600', _dark: 'yellow.200'},
  // The reference microphone's spectrum, over those bars. Off the ramp on
  // purpose: every other series colour here distinguishes one averaging window
  // from another of the same measurement, and this one distinguishes a second
  // instrument. Cyan reads at 3:1 or better against the section's ground and is
  // far enough from yellow.200 to stay legible where the two lines cross.
  //
  // The light half mirrors that arrangement rather than repeating its hue: the pair on
  // the page is warm against cool, and with the monitor's own bars turning blue in light
  // the second instrument has to go the other way to stay the other instrument. Orange
  // against blue is also the one pair no colour-vision deficiency collapses. Cyan would
  // have been neither — beside blue.600 it is a shade of the same thing.
  'chart.band.ref': {_light: 'orange.700', _dark: 'cyan.300'},

  // The map. Only the anchors that have to agree with the rest of the page are tokens —
  // the ground, the labels, the pin's two greys and the ramp its levels are coloured by;
  // the basemap's own lightness ladder stays local to mapStyle.ts, where it has one
  // consumer and means nothing to anything else.
  'map.ground': 'gray.900',
  'map.label': 'gray.400',
  'map.pin.fill': 'gray.50',
  'map.pin.label': 'gray.900',
  'map.pin.fillStale': 'gray.400',
  'map.pin.labelStale': 'gray.700',

  // The pin ramp: how loud, as a colour, so a site can be read at a glance without
  // reading six numbers. Green through yellow to orange in even 10 dB steps from 50 (see
  // pinScale): green for quiet is the convention every noise map uses, and the one thing
  // about this scale nobody has to be told.
  //
  // Hue, nearly only: the first four sit at the same perceptual lightness (OKLCH L 0.80),
  // stepping from green (h 150) through lime and yellow to amber (h 85), each at the most
  // chroma sRGB allows there. The hot end steps off it — band 5 to L 0.76 at h 62, band 6 to
  // L 0.69 at h 36 — because orange and red-orange at L 0.80 can only be peach and salmon,
  // and the top of the scale has to look hot. Still clear of the over-limit pin's red.600,
  // which is darker and redder again.
  //
  // The default scale has no lime, and its steps are not level across hues — green.500
  // beside yellow.200 read as a dark pin and a pale one before they read as two
  // colours — so these are written out as hex rather than picked off it.
  //
  // Two adjacent steps here are a step apart in hue — but the honest reason this is
  // legible at six steps is that colour is never the only cue: every pin prints its own
  // number, and the legend at the corner of the map spells the boundaries. Under a
  // red-green deficiency the green end and the orange end can come close, which is the
  // price of green for quiet; the numbers are what carry it there.
  //
  // Every step takes the dark `map.pin.label` over it (5.9:1 at the worst, band 6; 9:1 or
  // better on the first four). One label colour for the ramp is also what
  // keeps a pin from changing two things at once as a stage gets louder.
  //
  // Numbered rather than named — `quiet`/`loud` would be six adjectives for what is one
  // ordered scale, and the numbers are the order.
  'map.pin.band.1': '#49de78',
  'map.pin.band.2': '#94d53c',
  'map.pin.band.3': '#cfc20c',
  'map.pin.band.4': '#edb40e',
  'map.pin.band.5': '#fd9305',
  'map.pin.band.6': '#ff6034',

  // Over the limit written for that place: the pill turns red, and its number and the
  // triangle ahead of it (the same sign the cards print beside theirs, see
  // LocationReadings) turn white. Red is the one colour the ramp stops short of, so an
  // over-limit pin cannot be mistaken for a loud band — and the sign keeps it from resting on
  // colour alone. White on red.600 is 4.8:1. `gray.50` stands in for white, the table
  // resolving scale steps only; it is the same near-white the plain pill is filled with.
  'map.pin.fillOver': 'red.600',
  'map.pin.over': 'gray.50',
} as const;

/**
 * Which half of a two-valued token to take.
 *
 * Named rather than a boolean because it is what the caller *is* — a chart on the page,
 * a chart in a light panel — and the canvas has no way to find that out for itself. See
 * themeHex.
 */
export type Appearance = 'light' | 'dark';

export type NoiseColorToken = keyof typeof NOISE_COLORS;

// A step, or one step per appearance. The step alone is the common case and reads as
// "this colour does not depend on where it is drawn", which for everything on the
// section's own page is true. A step is a scale name (`gray.900`) or, where no step of the
// default scale is the colour wanted, a 6-digit hex written out (see the pin ramp).
type NoiseColorValue = string | {_light: string; _dark: string};

const isHex = (step: string) => /^#[0-9a-f]{6}$/i.test(step);

// How a step is written into Chakra's token tree: a reference to the scale, or the literal.
const tokenRef = (step: string) => (isHex(step) ? step : `{colors.${step}}`);

const stepFor = (value: NoiseColorValue, appearance: Appearance): string =>
  typeof value === 'string'
    ? value
    : appearance === 'light'
      ? value._light
      : value._dark;

// The runtime half of the type above, for the tests that walk every token.
export const NOISE_COLOR_TOKENS = Object.keys(
  NOISE_COLORS,
) as NoiseColorToken[];

// What series.ts stores instead of a hex. Derived from the table rather than
// written out, so a series token that isn't in the theme is a type error at the
// point it is used.
export type ChartSeriesToken = Extract<NoiseColorToken, 'chart.series'>;
export type ChartDeviceToken = Extract<
  NoiseColorToken,
  `chart.device.${number}`
>;

// The accent, and the whole of it: one hue per appearance, aliased rather than
// re-specified so that retuning the section is a single edit. Chakra's
// `yellow.contrast` is already black in both modes, which is what a yellow solid
// needs, so the semantic block below only has to differ where we want it to.
//
// Two hues because the section now has two grounds. Yellow was picked against the
// page; on white it is a highlighter — and white is where the calibration panel
// now paints a dropzone, a progress bar and a lit toggle out of this palette.
// Blue is what the rest of /crew already uses on a light ground (see theme-crew's
// links and focus rings), so this is the section falling in with the area it sits
// in rather than inventing a second light accent of its own.
const ACCENT_HUE = 'yellow';
const ACCENT_HUE_LIGHT = 'blue';

/**
 * One entry of the accent block: the light hue's token, and the dark hue's.
 *
 * Both halves are aliases rather than values, so neither palette is restated here — the
 * day Chakra retunes either one, this follows. `dark` is given separately only where the
 * yellow half is pinned to a step rather than to a semantic name, which is the two places
 * the section insists on exactly #facc15.
 */
const accentPair = (light: string, dark: string = light) => ({
  value: {
    _light: `{colors.${ACCENT_HUE_LIGHT}.${light}}`,
    _dark: `{colors.${ACCENT_HUE}.${dark}}`,
  },
});

const SCALE = defaultConfig.theme!.tokens!.colors! as Record<
  string,
  Record<string, {value: string}>
>;

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const; // prettier-ignore

// Canvas 2D rejects `var(...)`, and Google Maps wants a style object of plain
// strings, so both need the concrete value rather than the token. Resolving it
// from the table at module load — rather than reading a CSS variable off the
// document once the plot mounts — is what makes those two layers testable in
// node, safe under SSR, and free of a fallback colour that can drift away from
// the token it stands in for. It also keeps a var-of-var chain off a canvas
// `strokeStyle`, where an unresolved `var()` string fails silently to black.
const resolve = (appearance: Appearance) =>
  Object.fromEntries(
    NOISE_COLOR_TOKENS.map((token) => {
      const step = stepFor(NOISE_COLORS[token], appearance);
      if (isHex(step)) return [token, step];
      const [family, level] = step.split('.');
      const value = SCALE[family!]?.[level!]?.value;
      if (!value) {
        throw new Error(`theme-noise: unknown scale step ${step} for ${token}`);
      }
      return [token, value];
    }),
  ) as Record<NoiseColorToken, string>;

// Both halves resolved up front rather than on demand: the table is a few dozen
// entries, the work is a string split and two lookups, and doing it once means a
// canvas asking for a colour mid-draw is a property read.
export const NOISE_HEX = Object.freeze({
  light: Object.freeze(resolve('light')),
  dark: Object.freeze(resolve('dark')),
});

/**
 * A noise token's concrete hex, for the canvas and map layers.
 *
 * `dark` by default, which is every caller but one: the section's page renders dark, and
 * so does everything drawn on it. The exception says so at the call site (see
 * CalibrationResultChart) rather than sniffing the DOM for it — which is not a shortcut
 * but the only workable answer. A canvas cannot inherit a CSS colour, and reading the
 * variable back is worse than it looks: Chakra compiles these to `var()` chains and
 * `getPropertyValue` returns a custom property *unresolved*, so what would reach
 * `fillStyle` is the literal string `var(--colors-…)`, which fails silently to black.
 * Appearance is a fact about where a chart is mounted, and the thing that mounts it is
 * the thing that knows.
 */
export const themeHex = (
  token: NoiseColorToken,
  appearance: Appearance = 'dark',
): string => NOISE_HEX[appearance][token];

// The flat table above, folded into the nested shape Chakra wants. Written as a
// fold rather than by hand so the two can't disagree about what exists.
const nest = (paths: readonly NoiseColorToken[]) => {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const keys = path.split('.');
    let node = out;
    for (const key of keys.slice(0, -1)) {
      node = (node[key] ??= {}) as Record<string, unknown>;
    }
    const step = NOISE_COLORS[path] as NoiseColorValue;
    // A pair becomes a condition, which is the whole of what a Chakra consumer needs:
    // `color="chart.band.bar"` inside a light panel resolves to the light half with
    // nothing passed to it, unlike the canvas above.
    node[keys[keys.length - 1]!] = {
      value:
        typeof step === 'string'
          ? tokenRef(step)
          : {_light: tokenRef(step._light), _dark: tokenRef(step._dark)},
    };
  }
  return out;
};

/** `tokens.colors` — merged into the crew system by theme-crew.ts. */
export const noiseColors = {
  // The numeric scale, not just the semantic block: Chip reaches for
  // `colorPalette.600` directly, because the semantic surfaces stop at
  // `emphasized` and a filled chip's hover wants the step above it.
  accent: Object.fromEntries(
    STEPS.map((step) => [step, {value: `{colors.${ACCENT_HUE}.${step}}`}]),
  ),
};

/** `semanticTokens.colors` — merged into the crew system by theme-crew.ts. */
export const noiseSemanticColors = {
  ...nest(NOISE_COLOR_TOKENS),
  // Defining this block is what registers `accent` as a colorPalette; the keys
  // are Chakra's own contract for one. Two of them deliberately differ from
  // the yellow palette they otherwise alias, so that the section has exactly
  // one accent value: the focus ring, a lit chip, the timeline's crop grips and
  // the chart series are all literally #facc15. That equality is
  // pinned by theme-noise.test.ts — and it does mean `colorPalette="accent"`
  // and `colorPalette="yellow"` are not interchangeable.
  accent: {
    contrast: accentPair('contrast'),
    fg: accentPair('fg'),
    subtle: accentPair('subtle'),
    muted: accentPair('muted'),
    emphasized: accentPair('emphasized'),
    // The two the section pins to a step rather than to a name, in dark: `solid` is the
    // chart series' shade and `focusRing` is that same value again, which is the
    // whole of what "one accent" means here. Light has no series to agree with, so both
    // take blue's own semantic answer — and `solid` is then literally what fills a
    // primary button (see theme-crew), which is the same claim made the other way round.
    solid: accentPair('solid', '400'),
    focusRing: accentPair('focusRing', '400'),
    border: accentPair('border'),
  },
};
