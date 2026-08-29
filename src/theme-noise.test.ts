import {describe, expect, it} from 'vitest';
import system from './theme-crew';
import {
  NOISE_COLOR_TOKENS,
  NOISE_HEX,
  themeHex,
  type NoiseColorToken,
} from './theme-noise';
import {SERIES} from './components/noise/series';

type Token = {
  value?: string;
  originalValue?: string;
  extensions?: {conditions?: Record<string, string>};
};

const conditionsOf = (path: string) =>
  (system.tokens.getByName(path) as Token | undefined)?.extensions?.conditions;

// The concrete colour a token renders as in this section, following the chain of
// references down to a scale step and taking the named half wherever a token has
// two. Comparing resolved colours rather than reference strings is what lets an
// assertion below say "the accent is the middle of the ramp" without caring how
// many aliases apart the two are written — and, now that the accent has a light
// half of its own, what lets the same assertion be made about blue.
function resolvedHex(path: string, half: '_light' | '_dark'): string {
  const token = system.tokens.getByName(path) as Token | undefined;
  if (!token) throw new Error(`theme-noise.test: unknown token ${path}`);
  const conditions = conditionsOf(path);
  const raw =
    conditions?.[half] ??
    conditions?.base ??
    token.originalValue ??
    token.value;
  const reference = typeof raw === 'string' && raw.match(/^\{(.+)\}$/);
  return reference ? resolvedHex(reference[1]!, half) : String(raw);
}

const darkHex = (path: string) => resolvedHex(path, '_dark');
const lightHex = (path: string) => resolvedHex(path, '_light');

// The `chart.*` / `map.*` names the assembled theme actually registered, read
// back off the token registry rather than off the table that produced them.
const registered = [
  ...new Set(
    (system.tokens.allTokens as Array<{name: string}>)
      .map((t) => t.name)
      .filter((n) => /^colors\.(chart|map)\./.test(n))
      .map((n) => n.slice('colors.'.length)),
  ),
].sort();

describe('theme-noise', () => {
  // The invariant behind LevelTrace's `fill()`, which appends an alpha pair to
  // the resolved value to lay a 15 % wash under the trace. A token that came
  // back as `rgb(...)`, a shorthand, or an unresolved `var()` would make that a
  // silently broken string and the area would draw as black or not at all.
  it('resolves every token to a 6-digit hex', () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const token of NOISE_COLOR_TOKENS) {
        expect(themeHex(token, appearance), `${token} ${appearance}`).toMatch(
          /^#[0-9a-f]{6}$/i,
        );
      }
    }
  });

  // Both directions: a token added to the theme but not the list is invisible to
  // the canvas layer, and one added to the list but not the theme is a name no
  // stylesheet defines. Either way the two halves have stopped describing the
  // same set.
  it('lists exactly the chart.* and map.* tokens the theme defines', () => {
    expect([...NOISE_COLOR_TOKENS].sort()).toEqual(registered);
  });

  describe('the series ramp', () => {
    // Every kind the chart can plot has somewhere to get its colour from.
    it('covers every SeriesKind', () => {
      for (const kind of new Set(SERIES.map((s) => s.kind))) {
        expect(NOISE_COLOR_TOKENS).toContain(`chart.series.${kind}`);
      }
    });

    // The validated palette, pinned in ramp order. These five were checked
    // against this section's ground for chroma and for at least 3:1 contrast —
    // the shade this replaced at the peak end was 2.74:1 and failed — so a
    // "small tweak" here should have to be a deliberate one.
    it('is the palette that was validated against the page ground', () => {
      expect([
        themeHex('chart.series.eq_fast'),
        themeHex('chart.series.eq_5m'),
        themeHex('chart.series.eq_30m'),
        themeHex('chart.series.fmax'),
        themeHex('chart.series.peak'),
      ]).toEqual(['#fef08a', '#facc15', '#fb923c', '#f87171', '#dc2626']);
    });

    // The band spectrum is the same measurement drawn against frequency, so its
    // bars are the fast window's shade rather than a colour of their own.
    it('draws the band spectrum in shades the time chart already uses', () => {
      expect(themeHex('chart.band.bar')).toBe(themeHex('chart.series.eq_fast'));
    });

    // And the one exception, for the one thing that is not the same measurement: a
    // reference microphone is a second instrument, not a second averaging window, so
    // its line sits off the ramp on purpose. Pinned in both directions, because
    // "a slightly warmer blue" is exactly how a second series ends up indistinguishable
    // from the bars it is drawn over.
    it('draws the reference microphone off the ramp entirely', () => {
      expect(themeHex('chart.band.ref')).toBe('#67e8f9');
      const ramp = NOISE_COLOR_TOKENS.filter((t) =>
        t.startsWith('chart.series.'),
      ).map((t) => themeHex(t));
      expect(ramp).not.toContain(themeHex('chart.band.ref'));
      expect(themeHex('chart.band.ref')).not.toBe(themeHex('chart.band.bar'));
    });
  });

  describe('the accent', () => {
    // The section has one accent value. The focus ring, a lit chip, the crop
    // grips on the timeline and the middle of the series ramp are all this
    // colour, and the point of saying so here is that they cannot drift apart
    // without a test going red.
    it('is the middle of the series ramp', () => {
      expect(darkHex('colors.accent.solid')).toBe(
        themeHex('chart.series.eq_5m'),
      );
      expect(darkHex('colors.accent.focusRing')).toBe('#facc15');
    });

    // Setting `colorPalette="accent"` only works if the semantic block above
    // registers one, which is a Chakra contract rather than anything visible in
    // the file that writes it.
    it('is usable as a colorPalette', () => {
      expect(system.tokens.colorPaletteMap.has('accent')).toBe(true);
    });

    // /crew is blue; only the dark half — which is only ever this section — is
    // yellow. A flat value here would repaint every focus ring in the crew area.
    it('takes the focus ring in dark and leaves the rest of crew blue', () => {
      expect(conditionsOf('colors.gray.focusRing')).toEqual({
        _light: '{colors.blue.focusRing}',
        _dark: '{colors.accent.focusRing}',
      });
    });

    // Chip's `plain` hover reaches for `colorPalette.600` because the semantic
    // surfaces stop at `emphasized`. That is a step *up* only in a dark theme,
    // which is the precondition its comment states — enforced here for the two
    // palettes it is actually used with.
    it('keeps step 600 above dark `emphasized`, which Chip depends on', () => {
      for (const palette of ['gray', 'accent']) {
        const step600 = darkHex(`colors.${palette}.600`);
        const emphasized = darkHex(`colors.${palette}.emphasized`);
        expect(luma(step600), palette).toBeGreaterThan(luma(emphasized));
      }
    });
  });

  // chart.* points at raw scale steps rather than at fg.muted/border.emphasized,
  // because the canvas layer has to resolve them with no DOM and a light/dark
  // pair is not statically resolvable. These two assertions buy back the
  // coupling that gives up: the chart's axes and the UI's type still agree.
  it('keeps the chart chrome in step with the UI semantics', () => {
    expect(themeHex('chart.axis')).toBe(darkHex('colors.fg.muted'));
    expect(themeHex('chart.grid')).toBe(darkHex('colors.border.emphasized'));
    expect(themeHex('chart.playhead')).toBe(darkHex('colors.fg'));
    expect(themeHex('map.ground')).toBe(darkHex('colors.bg'));
    // The load-bearing one: the limit rules' halo is only invisible *as* a halo while it is
    // the ground behind the plot. Let `bg` move without this and every dash on every chart
    // grows a grey outline — the one thing the halo exists to avoid, and silent.
    expect(themeHex('chart.ground')).toBe(darkHex('colors.bg'));
  });

  // The half the calibration chart draws in, which is the only thing in the section on a
  // light ground (see CalibrationResultChart). Almost nothing has one: a token with no
  // pair answers with its single step in both appearances, which is correct for everything
  // that is only ever drawn on the page.
  describe('the light half', () => {
    // Contrast against white, WCAG's ratio. Not imported from anywhere because nothing
    // else in the app computes one — the palette was checked once, by hand, and this is
    // what keeps the answer from drifting.
    const contrast = (hex: string): number => {
      const channel = (v: number) =>
        v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      const n = parseInt(hex.slice(1), 16);
      const l =
        0.2126 * channel(((n >> 16) & 255) / 255) +
        0.7152 * channel(((n >> 8) & 255) / 255) +
        0.0722 * channel((n & 255) / 255);
      return 1.05 / (l + 0.05);
    };

    // The two series in that chart. 3:1 is the floor for a mark you read as a shape — the
    // bars — and 4.5:1 the floor for the same token lettering the two levels in the
    // readout beside them, so both clear the higher one. yellow.600 is 2.94:1 and is why
    // the light half is not simply the ramp's own answer one step down.
    it('clears 4.5:1 on white for the two the chart draws in', () => {
      expect(contrast(themeHex('chart.band.bar', 'light'))).toBeGreaterThan(
        4.5,
      );
      expect(contrast(themeHex('chart.band.ref', 'light'))).toBeGreaterThan(
        4.5,
      );
    });

    // Axis labels are 10 px type and read as text; a grid line is meant to be read past.
    it('keeps the axis legible and the grid faint', () => {
      expect(contrast(themeHex('chart.axis', 'light'))).toBeGreaterThan(4.5);
      expect(contrast(themeHex('chart.grid', 'light'))).toBeLessThan(2);
    });

    // The section's colour in light is blue, and it is one value there exactly as yellow
    // is one value in dark: the bars of the calibration chart, the fill of a primary
    // button, the dropzone's drag state and the progress bar are all `blue.solid`. Pinned
    // through the accent rather than against a literal, so retuning the hue is still the
    // one edit ACCENT_HUE_LIGHT promises.
    it('is the same blue in the chart as in the accent', () => {
      expect(themeHex('chart.band.bar', 'light')).toBe(
        lightHex('colors.accent.solid'),
      );
      expect(lightHex('colors.accent.solid')).toBe(
        lightHex('colors.blue.solid'),
      );
      // And the dark half is untouched by any of it — the page is still yellow.
      expect(darkHex('colors.accent.solid')).toBe('#facc15');
    });

    // Warm against cool in dark, cool against warm in light. What must not happen is the
    // two instruments landing in one hue family, which is what cyan beside blue would be.
    it('keeps the two instruments in opposing hues', () => {
      expect(themeHex('chart.band.ref', 'light')).not.toBe(
        themeHex('chart.band.bar', 'light'),
      );
      const [barR, , barB] = rgb(themeHex('chart.band.bar', 'light'));
      const [refR, , refB] = rgb(themeHex('chart.band.ref', 'light'));
      expect(barB).toBeGreaterThan(barR);
      expect(refR).toBeGreaterThan(refB);
    });

    // The readout pill is the one surface here, and its text is `fg.muted` — which follows
    // the appearance on its own. A dark pill in a light panel is how that ends up dark on
    // dark, so the pill has to turn with it.
    it('turns the readout pill over with everything else', () => {
      expect(contrast(themeHex('chart.readout.bg', 'light'))).toBeLessThan(1.2);
      expect(contrast(themeHex('chart.readout.bg', 'dark'))).toBeGreaterThan(4);
    });

    // A pair reaches Chakra as a condition, which is what makes the CSS side need no
    // appearance passed to it: the tooltip's `color="chart.band.bar"` follows the panel it
    // is in. Checked on the assembled system rather than on the table that fed it.
    it('registers a pair as a condition rather than a flat value', () => {
      expect(conditionsOf('colors.chart.band.bar')).toEqual({
        _light: '{colors.blue.600}',
        _dark: '{colors.yellow.200}',
      });
      // And a token with no pair stays one value under `base`, which is Chakra's
      // normalisation of a flat one — not a `_light`/`_dark` pair whose halves happen to
      // agree. The difference matters the day one of them is edited.
      expect(conditionsOf('colors.chart.ground')).toEqual({
        base: '{colors.gray.900}',
      });
    });
  });
});

// The three channels of a 6-digit hex, for assertions about hue rather than lightness.
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Relative luminance, only precise enough to order two greys.
function luma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); // prettier-ignore
}

// A primary button is blue across /crew (see theme-crew), which is a claim about the
// assembled recipe rather than about a token — so it is checked by resolving the recipe
// the way a rendered Button would and looking at what it sets `color-palette` to.
describe('primary buttons', () => {
  // Chakra nests a recipe's output under its cascade layer, and types it as its own
  // style shape rather than as a bag of declarations — which is what these two are read
  // as here, custom properties and all.
  const layer = (variant: string) =>
    (
      system.cva(system.getRecipe('button'))({variant}) as unknown as Record<
        string,
        Record<string, string>
      >
    )['@layer recipes']!;

  const solid = layer('solid');
  const outline = layer('outline');

  it('fills a solid button from the blue palette', () => {
    expect(solid['--chakra-colors-color-palette-solid']).toBe(
      'var(--chakra-colors-blue-solid)',
    );
    // The fill is `colorPalette.solid` and not a colour written out, which is what leaves
    // the hover, the expanded state and the contrast pair to Chakra's own recipe.
    expect(solid['background']).toBe(
      'var(--chakra-colors-color-palette-solid)',
    );
  });

  // Only the primary one. An outline or a ghost button is the same action offered
  // quietly, and a blue one would read as a second thing to press on every card in the
  // area — including the Cancel beside the calibration run.
  it('leaves the quiet variants on the default palette', () => {
    expect(outline['--chakra-colors-color-palette-solid']).toBeUndefined();
  });
});

// Guards the cast in NOISE_HEX: the frozen records and the token list are one
// object built three ways, and nothing else checks they stayed that. Both halves,
// because a token with only one of them is a colour that resolves to undefined in
// whichever appearance was forgotten — and on a canvas that is a silent black.
it('exposes a hex for every listed token, in both appearances', () => {
  const tokens = [...(NOISE_COLOR_TOKENS as NoiseColorToken[])].sort();
  expect(Object.keys(NOISE_HEX.dark).sort()).toEqual(tokens);
  expect(Object.keys(NOISE_HEX.light).sort()).toEqual(tokens);
});
