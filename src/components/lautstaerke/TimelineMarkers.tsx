import {Box} from '@chakra-ui/react';
import {memo, useEffect, useMemo, useRef, useState} from 'react';
import {AXIS_FONT_FAMILY, AXIS_FONT_SIZE} from './chartUtils';
import {thinGaps, type LogGap} from './logCoverage';
import {axisFraction, timelineTicks} from './timelineTicks';

// The time axis behind the project timeline's thumbs: long marks on the coarse tier,
// notches between them, and nothing that can be pointed at. Which unit each tier stands
// for — days against hours across a festival, hours against quarters within one day —
// is timelineTicks' to decide, along with which marks get a label. This file only knows
// which of its marks runs furthest; that is what lets one set of heights serve both
// readings.
//
// And, behind all of it, where the event has no readings at all — the one thing on this
// strip that is about the data rather than about the clock. It lives here rather than as
// a fourth sibling in the Control for three reasons, each already established below: this
// is the component that measures the axis, so the shading needs no second ResizeObserver;
// it owns the clip/axis box pair, so a gap edge and the tick standing on it are placed in
// one coordinate system and cannot come out a rounding apart; and tree order alone then
// stacks it correctly, under the grid and under both grips.

// The labels take the bottom of the strip and the lines have the rest. Inside it rather
// than under it because the strip is a toolbar — a row of type below it would cost the
// map a line of height for something the strip has room for.
const LABEL_ROW_H = 13;

// A major mark runs the full height of the lines' band; a minor tick is a notch off the
// top of it. Length is the whole of what separates the tiers — which is why the same
// heights serve a festival marking days against hours and an evening marking hours
// against quarters.
const MINOR_TICK_H = 7;

// Between the two: a labelled mark that isn't a major one, which the pair alone leaves
// looking like a bare notch that happens to have type under it. Labels are their own
// ladder in timelineTicks, constrained only to land *on* a line, so at a fine tick step
// the labelled line need not be a unit — half past the hour among quarters, say. Long
// enough to be found from the label, short of the major mark so the coarse tier still
// reads.
const LABELLED_TICK_H = 14;

// Every hairline the strip draws — every tier of tick and the rule around the track
// itself (see ProjectTimeline) — is `chart.rule`, the section's one hairline. Flat, not
// translucent: a tick standing on the track's own edge would otherwise lay its alpha over
// that line and come out brighter than either, so the grid would light up at exactly the
// four places it meets the frame. One opaque value can only ever draw itself.
//
// The token is a step lighter than `border.emphasized` because it has to read on both
// grounds the strip has: lighter and cooler than the lit window (a 15 % accent wash over
// the toolbar) so a tick stays legible inside the crop, and far enough off the toolbar
// itself (the page ground, the track being unfilled) to be plain outside it.

// Every mark is a bare span carrying one inline `left`, and all of the styling that
// doesn't move is here — one object, hashed by Emotion once for the session, rather
// than ten style props on each of fifty Boxes re-serialized on every resize. The same
// shape as READOUT_CSS and LevelTrace's CHART_CSS, for the same reason.
// How narrow a hole may be drawn. Two pixels rather than one, so a single missing minute
// on a four-day project is a mark you can see rather than a hairline indistinguishable
// from a tick. thinGaps widens to it and merges what that brings together — see there for
// why widening beats dropping.
const GAP_MIN_W = 2;

// How far the shading holds off the strip's own frame, on all four sides. The frame is a
// hairline in `chart.rule` and the crop is banded top and bottom in the accent on top of
// it (see ProjectTimeline), so a band running edge to edge sat directly against both and
// read as a fill with a border rather than as something laid inside the strip. The frame's
// own width, and then air: what separates the two is that there is a gap between them.
//
// A plain figure rather than the timeline's FRAME_W plus a margin, for the same reason
// `overhang` is a prop: this is a child of that file, and importing a constant back out of
// it would make the two import each other. Two pixels is the hairline and one clear of it,
// which is the least this can be and still be a gap rather than a rounding.
const GAP_INSET = 2;

const GAP_ATTR = 'data-gap';
const TICK_ATTR = 'data-tick';
const MAJOR_ATTR = 'data-major';
const LABELLED_ATTR = 'data-labelled';
const LABEL_ATTR = 'data-label';
const MARKERS_CSS = {
  // A stretch nobody reported in, held off the strip's frame on all four sides by
  // GAP_INSET — so it is a band lying inside the strip rather than a fill of it.
  //
  // Hatched rather than filled, because this box has two grounds to read on: the page's
  // own outside the crop, and a 15 % accent wash inside it. A flat neutral over the second
  // reads as another *value* — a third band of colour competing with the lit window —
  // where a diagonal hatch reads as "nothing here" on both, and it does so without hiding
  // the ticks that draw over the top of it.
  //
  // `chart.gap` is its own token because a texture is not a line: a third of the band is
  // stripe and two thirds is ground, so what reads is the average of the two rather than
  // the value. See theme-noise.ts — and note that the step there and the pitch below are
  // one setting, since it is their product the eye is given.
  //
  // As a CSS variable and not the token, because a gradient is a raw string and Chakra
  // resolves neither token paths nor its `/alpha` suffix inside one.
  [`& [${GAP_ATTR}]`]: {
    position: 'absolute',
    top: `${GAP_INSET}px`,
    bottom: `${GAP_INSET}px`,
    // A one-pixel stripe every three. The pitch and the step in theme-noise are one
    // setting, not two: what the band weighs is their product, not the line on its own. So
    // the two are written as a ratio held at a third — retuning the texture is a matter of
    // moving both and leaving the weight where it is, and a fifth covered, which is where
    // this started, is a shading you can compute and cannot see.
    backgroundImage:
      'repeating-linear-gradient(45deg, var(--chakra-colors-chart-gap) 0 1px, transparent 1px 3px)',
  },
  [`& [${TICK_ATTR}]`]: {
    position: 'absolute',
    top: '0',
    w: '1px',
    h: `${MINOR_TICK_H}px`,
    bg: 'chart.rule',
  },
  // Two attributes, so each outranks the rule above by specificity rather than by source
  // order — every tier is the same span with further to run, and nothing else. That they
  // all share one colour is also what lets a mark cross the track's edge without showing
  // a join.
  [`& [${TICK_ATTR}][${LABELLED_ATTR}]`]: {
    h: `${LABELLED_TICK_H}px`,
  },
  // Last of the three, so it wins on source order where a mark is both: these two rules
  // are the same specificity, and a labelled major mark is a major one. Reaching for the
  // label row rather than a height, so the band's own depth is stated once — the strip is
  // free to change height without this following it.
  [`& [${TICK_ATTR}][${MAJOR_ATTR}]`]: {
    h: 'auto',
    bottom: `${LABEL_ROW_H}px`,
  },
  // The one thing here that is not a line, so the one thing that is not `chart.rule`:
  // type at the ticks' own value would be too dim to read. `chart.axis` is the token the
  // row charts letter their axes in, so the two axes agree by construction rather than by
  // two files happening to name the same step.
  [`& [${LABEL_ATTR}]`]: {
    position: 'absolute',
    bottom: '0',
    // Centred on its own line, at every position on the axis including the two ends. One
    // value for the whole axis and no clamping anywhere: a label that runs past the strip
    // is cut by the strip (see the clip box below), which keeps every label pointing at
    // the line it names. Shifting the outermost ones in to fit instead put type where its
    // line is not, and dropping them left the axis unlabelled exactly where it says which
    // day it starts on.
    transform: 'translateX(-50%)',
    fontFamily: AXIS_FONT_FAMILY,
    fontSize: `${AXIS_FONT_SIZE}px`,
    lineHeight: `${LABEL_ROW_H}px`,
    color: 'chart.axis',
    whiteSpace: 'nowrap',
  },
} as const;

/**
 * The strip's time markers, positioned in the value axis' own coordinates.
 *
 * Mounted as a sibling of the slider's Track and not a child of it: the track is pulled
 * out over the root's padding (see ProjectTimeline's HANDLE_W), so its box is wider than
 * the axis these fractions are in. Its parent is the Control, whose box *is* the axis, so
 * `left: f%` needs nothing measured — and so the inner layer, being inset to nothing on
 * that same box, can measure itself for the one thing that does need pixels: how many of
 * its own marks to draw.
 *
 * Two boxes rather than one, because the two ends want opposite things. The marks are
 * placed on the axis, and the outermost labels — centred on their own line, like every
 * other — hang past it. They are cut rather than moved or dropped, and the honest place
 * to cut them is the edge of the strip the reader sees, which is `overhang` further out
 * on either side. So the outer box takes the track's geometry and clips; the inner one is
 * the axis, and is what everything inside is positioned and measured against.
 *
 * Measuring here rather than in the timeline is what keeps a resize off the slider: the
 * width lands in this component's state, so a drag on the window edge re-renders fifty
 * spans instead of the whole control and its three thumbs. Zero until the observer first
 * fires — the page server-renders, where there is no ResizeObserver, so a guess would be
 * a hydration mismatch and an empty strip is the honest first frame.
 *
 * No z-index. The Control is positioned but transparent to stacking, so tree order is
 * the whole rule: after the track this paints over the lit window (which is the point —
 * the crop is exactly where you want to know the time), and the thumbs carry a z-index
 * of their own, so the grips and the playhead still pass over the top.
 *
 * Not `Slider.Marks`, which Chakra insets by 4 px on each side while still placing each
 * mark at its plain value percentage — so the built-in markers sit off the very axis the
 * thumbs are on, which is the one thing this must not do.
 */
export const TimelineMarkers = memo(function TimelineMarkers({
  start,
  end,
  gaps,
  overhang,
}: {
  // Two numbers rather than the window object the timeline holds: this sits inside a
  // component that renders on every frame of a drag, and an object prop would be a new
  // identity each time and defeat the memo.
  start: number;
  end: number;
  // The stretches of the event nobody reported in, in epoch ms — an array and so the one
  // prop here that could defeat the memo, which is why it is memoized on the payload alone
  // upstream (see useProjectLogs) and never rebuilt by a gesture. Absent while the payload
  // is in flight, and while live mode is on and the strip is unmounted anyway.
  gaps?: readonly LogGap[];
  // How far the strip reaches past the axis at either end — a grip's width, which is the
  // timeline's own constant (HANDLE_W) and the same figure the track is pulled out by.
  // Passed rather than imported: this is a child of that file, and reading a constant back
  // out of it would make the two import each other.
  overhang: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);

  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    // Rounded, because the marks answer to whole pixels and a subpixel resize would
    // otherwise re-render them for an identical answer. React drops the update when the
    // rounded value is unchanged, so nothing further is needed to hold it still.
    const ro = new ResizeObserver(([entry]) =>
      setWidthPx(Math.round(entry?.contentRect.width ?? 0)),
    );
    ro.observe(layer);
    return () => ro.disconnect();
  }, []);

  const ticks = useMemo(
    () => timelineTicks({start, end}, widthPx),
    [start, end, widthPx],
  );

  // The same question the ticks ask of the width — how much of this is worth drawing at
  // the size we got — and so memoized the same way. Everything expensive about coverage
  // already happened once, upstream; this is only the layout of it.
  const shaded = useMemo(
    () => (gaps ? thinGaps(gaps, {start, end}, widthPx, GAP_MIN_W) : []),
    [gaps, start, end, widthPx],
  );

  return (
    // The strip's own box, to the pixel: absolute so it doesn't become a flex item of the
    // Control and take room from the track, reaching back out over the root's padding the
    // way the track does, and rounded to the same radius so a label cut at the very end is
    // cut by the corner it meets rather than square through it.
    //
    // aria-hidden and pointer-events-none here rather than on the layer inside, so the
    // whole of what this draws is covered by one of each: the instants are already spoken
    // by the thumbs (see ariaValueText), and anything hit-testable would take pointerdown
    // away from the strip's own pan and scrub gestures.
    <Box
      position="absolute"
      top="0"
      bottom="0"
      left={`-${overhang}px`}
      right={`-${overhang}px`}
      overflow="hidden"
      rounded="md"
      pointerEvents="none"
      aria-hidden
    >
      {/* The value axis, inset back to it. Rendered even while empty, because it is the
          box being measured. */}
      <Box
        ref={ref}
        position="absolute"
        top="0"
        bottom="0"
        left={`${overhang}px`}
        right={`${overhang}px`}
        css={MARKERS_CSS}
      >
        {/* Before the ticks, so tree order puts the grid over the shading and no z-index
            is needed here either — the same rule the whole of this layer is placed by.
            A gap that reaches either end of the axis is bled out into the overhang, so it
            runs to the visible edge of the strip and is cut by the clip box above rather
            than stopping a grip's width short of it. */}
        {shaded.map((gap) => {
          const from = axisFraction(gap.start, start, end) * 100;
          const to = axisFraction(gap.end, start, end) * 100;
          // Widened in pixels rather than moved, so the span still ends on the axis at
          // whichever end isn't touching one. A grip's width less the inset, not the whole
          // of it: the strip reaches `overhang` past the axis, so that figure would put the
          // shading hard against the frame's left or right edge — the one pair of sides the
          // vertical inset above cannot speak for.
          const bleed = overhang - GAP_INSET;
          const left = gap.start <= start ? bleed : 0;
          const right = gap.end >= end ? bleed : 0;
          return (
            <span
              key={gap.start}
              {...{[GAP_ATTR]: ''}}
              style={{
                left: `calc(${from}% - ${left}px)`,
                width: `calc(${to - from}% + ${left + right}px)`,
              }}
            />
          );
        })}
        {ticks.flatMap((tick) => {
          const fraction = axisFraction(tick.ms, start, end);
          // Per mark and per resize, so a raw style rather than a Chakra prop: Emotion
          // would hash a class for every distinct position. One object for the line and
          // the label it carries, which stand in the same column and are never styled
          // apart.
          const style = {left: `${fraction * 100}%`};
          return [
            <span
              key={tick.ms}
              {...{
                [TICK_ATTR]: '',
                [MAJOR_ATTR]: tick.major ? '' : undefined,
                // Off the label itself, so the middle tier cannot come to mean anything
                // other than "this line has type under it" — the two are one decision and
                // timelineTicks has already made it.
                [LABELLED_ATTR]: tick.label ? '' : undefined,
              }}
              style={style}
            />,
            tick.label && (
              <span
                key={`${tick.ms}:label`}
                {...{[LABEL_ATTR]: ''}}
                style={style}
              >
                {tick.label}
              </span>
            ),
          ];
        })}
      </Box>
    </Box>
  );
});
