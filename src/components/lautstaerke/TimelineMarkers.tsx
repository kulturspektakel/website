import {Box} from '@chakra-ui/react';
import {memo, useEffect, useMemo, useRef, useState} from 'react';
import {AXIS_FONT_FAMILY, AXIS_FONT_SIZE} from './chartUtils';
import {LABEL_W, axisFraction, timelineTicks} from './timelineTicks';

// The time axis behind the project timeline's thumbs: long marks on the coarse tier,
// notches between them, and nothing that can be pointed at. Which unit each tier stands
// for — days against hours across a festival, hours against quarters within one day —
// is timelineTicks' to decide, along with which marks get a label. This file only knows
// that one tier is longer than the other; that is what lets the same two heights serve
// both readings.

// The labels take the bottom of the strip and the lines have the rest. Inside it rather
// than under it because the strip is a toolbar — a row of type below it would cost the
// map a line of height for something the strip has room for.
const LABEL_ROW_H = 13;

// A major mark runs the full height of the lines' band; a minor tick is a notch off the
// top of it. Length is the whole of what separates the two tiers — which is why the
// same pair of heights serves a festival marking days against hours and an evening
// marking hours against quarters.
const MINOR_TICK_H = 7;

// Every hairline the strip draws — the two tiers of tick and the rule around the track
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
const TICK_ATTR = 'data-tick';
const MAJOR_ATTR = 'data-major';
const LABEL_ATTR = 'data-label';
const MARKERS_CSS = {
  [`& [${TICK_ATTR}]`]: {
    position: 'absolute',
    top: '0',
    w: '1px',
    h: `${MINOR_TICK_H}px`,
    bg: 'chart.rule',
  },
  // Two attributes, so it outranks the rule above by specificity rather than by source
  // order — the major mark is the same span with further to run, and nothing else. That
  // it shares the minor tier's colour is also what lets it cross the track's edge
  // without showing a join.
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
    fontFamily: AXIS_FONT_FAMILY,
    fontSize: `${AXIS_FONT_SIZE}px`,
    lineHeight: `${LABEL_ROW_H}px`,
    color: 'chart.axis',
    whiteSpace: 'nowrap',
  },
} as const;

// How far a label is pulled back over its own line. Centred everywhere it fits, flush at
// the two ends — and not the readout pill's continuous shift, which is right for a
// single pill that must always point at its thumb but would offset each of a row of
// labels by a different amount, so the row would read as drifting rather than as an axis.
const labelShift = (fraction: number, widthPx: number): number =>
  fraction * widthPx < LABEL_W / 2
    ? 0
    : (1 - fraction) * widthPx < LABEL_W / 2
      ? 100
      : 50;

/**
 * The strip's time markers, positioned in the value axis' own coordinates.
 *
 * Mounted as a sibling of the slider's Track and not a child of it: the track is pulled
 * out over the root's padding (see ProjectTimeline's HANDLE_W), so its box is wider than
 * the axis these fractions are in — and it clips, which would cut the labels at both
 * ends. Its parent is the Control, whose box *is* the axis, so `left: f%` needs nothing
 * measured — and so this layer, being inset to nothing on that same box, can measure
 * itself for the one thing that does need pixels: how many of its own marks to draw.
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
}: {
  // Two numbers rather than the window object the timeline holds: this sits inside a
  // component that renders on every frame of a drag, and an object prop would be a new
  // identity each time and defeat the memo.
  start: number;
  end: number;
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

  return (
    // Absolute, so it doesn't become a flex item of the Control and take room from the
    // track. Rendered even while empty, because it is the box being measured — and
    // aria-hidden and pointer-events-none, since the instants are already spoken by the
    // thumbs (see ariaValueText) and anything hit-testable here would take pointerdown
    // away from the strip's own pan and scrub gestures.
    <Box
      ref={ref}
      position="absolute"
      inset="0"
      pointerEvents="none"
      aria-hidden
      css={MARKERS_CSS}
    >
      {ticks.flatMap((tick) => {
        const fraction = axisFraction(tick.ms, start, end);
        // Per mark and per resize, so a raw style rather than a Chakra prop: Emotion
        // would hash a class for every distinct position.
        const left = `${fraction * 100}%`;
        return [
          <span
            key={tick.ms}
            {...{[TICK_ATTR]: '', [MAJOR_ATTR]: tick.major ? '' : undefined}}
            style={{left}}
          />,
          tick.label && (
            <span
              key={`${tick.ms}:label`}
              {...{[LABEL_ATTR]: ''}}
              style={{
                left,
                transform: `translateX(-${labelShift(fraction, widthPx)}%)`,
              }}
            >
              {tick.label}
            </span>
          ),
        ];
      })}
    </Box>
  );
});
