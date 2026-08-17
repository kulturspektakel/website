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
// references down to a scale step and taking the dark half wherever a token has
// two. Comparing resolved colours rather than reference strings is what lets an
// assertion below say "the accent is the middle of the ramp" without caring how
// many aliases apart the two are written.
function darkHex(path: string): string {
  const token = system.tokens.getByName(path) as Token | undefined;
  if (!token) throw new Error(`theme-noise.test: unknown token ${path}`);
  const conditions = conditionsOf(path);
  const raw =
    conditions?._dark ?? conditions?.base ?? token.originalValue ?? token.value;
  const reference = typeof raw === 'string' && raw.match(/^\{(.+)\}$/);
  return reference ? darkHex(reference[1]!) : String(raw);
}

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
    for (const token of NOISE_COLOR_TOKENS) {
      expect(themeHex(token), token).toMatch(/^#[0-9a-f]{6}$/i);
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
      ).map(themeHex);
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
});

// Relative luminance, only precise enough to order two greys.
function luma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); // prettier-ignore
}

// Guards the cast in NOISE_HEX: the frozen record and the token list are one
// object built two ways, and nothing else checks they stayed that.
it('exposes a hex for every listed token', () => {
  expect(Object.keys(NOISE_HEX).sort()).toEqual(
    [...(NOISE_COLOR_TOKENS as NoiseColorToken[])].sort(),
  );
});
