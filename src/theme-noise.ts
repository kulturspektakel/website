import {defaultConfig} from '@chakra-ui/react';

// The colour vocabulary of /crew/noise, in the one place that decides it.
//
// The section renders dark throughout — __root.tsx puts `.dark` on <html> for
// exactly this route subtree — so everything here is a dark-only decision and
// none of it carries a light half. That is also why the two *overrides* the
// section needs (the page ground and the focus ring) live in theme-crew.ts as
// `_dark` values rather than here: the dark half of a crew token is, by
// construction, the noise area's value. If /crew ever goes dark somewhere else
// that stops being true, and the fix is a custom condition —
// `conditions: {noise: '.noise &'}` on the system, `_noise` on those two
// tokens, and the class alongside `.dark` in __root.tsx.
//
// Everything below is a *new* name rather than an override, so it needs no
// scoping at all: nothing outside this section refers to `chart.*` or `map.*`,
// and `accent` is only ever asked for by name.

// One literal table: a token path against the Chakra scale step it stands for.
// Every other export is derived from it, so recolouring anything is one edit
// here rather than an edit here and a matching one in the canvas layer.
//
// Keys are spelled the way they will read as CSS variables. Chakra formats a
// var name by joining the path with `-` and then dash-casing it, which means
// camelCase gains a separator (`eqFast` → `eq-fast`) while an underscore is
// passed through untouched. `eqFast` and `eq-fast` therefore collide silently.
// The series keys are SeriesKind's own values verbatim (`eq_fast`, `eq_5m`, …)
// so the path is mechanically `chart.series.${kind}`, the variable is a
// greppable echo of it, and no two keys can fold together.
const NOISE_COLORS = {
  // The chart series ramp: a yellow → orange → red arc, lightest at the
  // shortest averaging window. Validated against the section's ground
  // (gray.900) for chroma and for ≥3:1 contrast — the previous peak shade was
  // 2.74:1 and failed. Adjacent pairs sit in the ΔE 6–8 colour-vision-deficiency
  // floor band, which is legal here because colour is never the only cue: the
  // trace plots one series at a time, and the big-number row that shows all
  // five at once labels every one of them.
  'chart.series.eq_fast': 'yellow.200',
  'chart.series.eq_5m': 'yellow.400',
  'chart.series.eq_30m': 'orange.400',
  'chart.series.fmax': 'red.400',
  'chart.series.peak': 'red.600',

  // Chart chrome. `rule` is the hairline the readout pills are outlined in and
  // the project timeline draws its ticks with — one step lighter than
  // `border.emphasized`, which is what it needs to be to stay visible both over
  // the toolbar and inside the 15% accent wash of a crop window.
  'chart.axis': 'gray.400',
  'chart.grid': 'gray.700',
  'chart.rule': 'gray.600',
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
  'chart.playhead': 'gray.50',
  'chart.readout.bg': 'gray.800',

  // The band spectrum's bars are the fast-window shade — it is the same
  // measurement, drawn against frequency instead of time.
  'chart.band.bar': 'yellow.200',
  // The reference microphone's spectrum, over those bars. Off the ramp on
  // purpose: every other series colour here distinguishes one averaging window
  // from another of the same measurement, and this one distinguishes a second
  // instrument. Cyan reads at 3:1 or better against the section's ground and is
  // far enough from yellow.200 to stay legible where the two lines cross.
  'chart.band.ref': 'cyan.300',

  // The map. Only the four anchors that have to agree with the rest of the page
  // are tokens; the basemap's own lightness ladder stays local to mapStyle.ts,
  // where it has one consumer and means nothing to anything else.
  'map.ground': 'gray.900',
  'map.label': 'gray.400',
  'map.pin.fill': 'gray.50',
  'map.pin.label': 'gray.900',
  'map.pin.fillStale': 'gray.400',
  'map.pin.labelStale': 'gray.700',
} as const;

export type NoiseColorToken = keyof typeof NOISE_COLORS;

// The runtime half of the type above, for the tests that walk every token.
export const NOISE_COLOR_TOKENS = Object.keys(
  NOISE_COLORS,
) as NoiseColorToken[];

// What series.ts stores instead of a hex. Derived from the table rather than
// written out, so a series token that isn't in the theme is a type error at the
// point it is used.
export type ChartSeriesToken = Extract<
  NoiseColorToken,
  `chart.series.${string}`
>;

// The accent, and the whole of it: one hue, aliased rather than re-specified so
// that retuning the section is a single edit. Chakra's `yellow.contrast` is
// already black in both modes, which is what a yellow solid needs, so the
// semantic block below only has to differ where we want it to.
const ACCENT_HUE = 'yellow';

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
export const NOISE_HEX = Object.freeze(
  Object.fromEntries(
    NOISE_COLOR_TOKENS.map((token) => {
      const [family, step] = NOISE_COLORS[token].split('.');
      const value = SCALE[family!]?.[step!]?.value;
      if (!value) {
        throw new Error(`theme-noise: unknown scale step ${NOISE_COLORS[token]} for ${token}`); // prettier-ignore
      }
      return [token, value];
    }),
  ) as Record<NoiseColorToken, string>,
);

/** A noise token's concrete hex, for the canvas and map layers. */
export const themeHex = (token: NoiseColorToken): string => NOISE_HEX[token];

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
    node[keys[keys.length - 1]!] = {value: `{colors.${NOISE_COLORS[path]}}`};
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
  // the middle of the series ramp are all literally #facc15. That equality is
  // pinned by theme-noise.test.ts — and it does mean `colorPalette="accent"`
  // and `colorPalette="yellow"` are not interchangeable.
  accent: {
    contrast: {value: `{colors.${ACCENT_HUE}.contrast}`},
    fg: {value: `{colors.${ACCENT_HUE}.fg}`},
    subtle: {value: `{colors.${ACCENT_HUE}.subtle}`},
    muted: {value: `{colors.${ACCENT_HUE}.muted}`},
    emphasized: {value: `{colors.${ACCENT_HUE}.emphasized}`},
    solid: {value: `{colors.${ACCENT_HUE}.400}`},
    focusRing: {value: `{colors.${ACCENT_HUE}.400}`},
    border: {value: `{colors.${ACCENT_HUE}.border}`},
  },
};
