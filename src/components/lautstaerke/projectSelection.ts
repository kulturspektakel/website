import {MINUTE_MS, QUARTER_MINUTES, clampTo, snapToQuarter} from './timeframe';

// A project page's selection: a sub-range of the project's window plus a cursor
// inside it. Component state on the layout, which the URL trails rather than drives (see
// projectSearch.ts): it filters data the browser already holds (see projectLogs.ts), so
// nothing reloads when it changes, and every gesture may commit per animation frame.
//
// Everything here speaks epoch milliseconds, because it exists to drive a
// slider. Its sibling, timeframe.ts, speaks Date, because it exists to drive a
// database query. Neither unit is wrong for its job, so the two live apart
// rather than converting at every call — this import is the whole seam.

// The part of a project you can actually pick in: never past the current time,
// because there are no measurements in the future. `end` is floored at `start` so
// a project that hasn't begun yet collapses to a point rather than inverting —
// the slider handles a degenerate window, an inverted one it would not.
export function visibleProjectWindow(
  project: {start: number; end: number},
  nowMs: number,
): {start: number; end: number} {
  return {
    start: project.start,
    end: Math.max(project.start, Math.min(project.end, nowMs)),
  };
}

export type ProjectSelection = {start: number; current: number; end: number};

// Whether two picks are the same pick, "nothing picked" included. Every writer here
// builds a fresh object — per frame of a drag, per navigation — and what matters is
// whether any of the three instants actually moved: an equal-but-new selection re-renders
// the page and re-keys everything derived from it for nothing.
export const sameSelection = (
  a: ProjectSelection | null,
  b: ProjectSelection | null,
): boolean =>
  a === b ||
  (a != null &&
    b != null &&
    a.start === b.start &&
    a.end === b.end &&
    a.current === b.current);

// What the user picked, resolved against the window — or, where they have picked
// nothing, the whole window with the cursor at its right edge, which for a running
// festival is now: the first switch out of live mode then freezes the moment you were
// watching rather than jumping to the festival's opening minute.
//
// The null is load-bearing, and the reason the page stores a pick rather than a
// resolved selection: the window's right edge follows the clock during a running
// festival, so an untouched timeline tracks it, and the first drag pins the crop.
export function resolveProjectSelection(
  chosen: ProjectSelection | null,
  window: {start: number; end: number},
): ProjectSelection {
  // orderSelection does the clamping and the ordering, so a pick made against a wider
  // window collapses the range rather than inverting it.
  return orderSelection(
    chosen ?? {start: window.start, end: window.end, current: window.end},
    window,
  );
}

// The slider's thumbs, and back again. The thumb count depends on the mode — live
// mode has no instant to point at, so it drops the cursor and leaves [start, end]
// — which means the indices aren't fixed and these two are the only places that
// know the mapping.
export const selectionThumbs = (
  selection: ProjectSelection,
  live: boolean,
): number[] =>
  live
    ? [selection.start, selection.end]
    : [selection.start, selection.current, selection.end];

export const thumbsToSelection = (
  thumbs: number[],
  live: boolean,
  previous: ProjectSelection,
): ProjectSelection =>
  live
    ? // The cursor is carried over, not discarded, so turning live off again returns
      // to the instant you were last looking at.
      {start: thumbs[0]!, end: thumbs[1]!, current: previous.current}
    : {start: thumbs[0]!, current: thumbs[1]!, end: thumbs[2]!};

// Clamp into the window and restore start <= current <= end. The slider won't let
// thumbs cross, so this is a safety net for typed input, and for an override made
// against a window that has since moved.
const orderSelection = (
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection => {
  const start = clampTo(selection.start, window.start, window.end);
  const end = Math.max(clampTo(selection.end, window.start, window.end), start);
  return {start, end, current: clampTo(selection.current, start, end)};
};

// What the slider commits on release. Only what the user actually moved snaps to a
// quarter hour: the fields still accept an exact time, so dragging the cursor must
// not quietly round a start that was typed in as 18:07, and re-snapping an
// untouched bound would fight manual entry.
export function commitProjectSelection(
  next: ProjectSelection,
  previous: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection {
  const moved = (key: keyof ProjectSelection) =>
    next[key] === previous[key] ? next[key] : snapToQuarter(next[key]);
  return orderSelection(
    {start: moved('start'), end: moved('end'), current: moved('current')},
    window,
  );
}

// The playhead moved and nothing else: what hovering a row chart commits.
//
// Deliberately unsnapped, unlike every gesture on the timeline itself. A hover reads
// an instant off a trace under the pointer, and rounding it to the quarter hour would
// light up a sample the pointer isn't on. The bounds are untouched, so a crop survives
// being hovered over — and the clamp is what keeps the playhead inside it when the
// pointer sits on the plot's very edge.
export const setSelectionCurrent = (
  selection: ProjectSelection,
  at: number,
): ProjectSelection => ({
  ...selection,
  current: clampTo(at, selection.start, selection.end),
});

// The grid every gesture on this page lands on. Exported because the timeline's
// keyboard stepping walks it too, and two derivations of one grid in the two files
// that have to agree about it is one too many.
export const QUARTER_MS = QUARTER_MINUTES * MINUTE_MS;

// One thumb moved by whole grid steps: what an arrow or page key on the timeline
// commits. Which thumb `index` names depends on the mode, so it is read and written
// through selectionThumbs/thumbsToSelection like every other thumb gesture.
//
// Snapped before it is clamped, so the first press off a bound typed as 18:07 lands
// on the grid rather than carrying that offset along for ever. Clamped to its
// neighbours after, so an edge stops at the playhead instead of pushing it — where
// zag's own stepping stops too, and only a pointer drag is allowed to push (see the
// timeline's `collision`).
export function nudgeSelectionThumb(
  selection: ProjectSelection,
  {index, steps, live}: {index: number; steps: number; live: boolean},
  window: {start: number; end: number},
): ProjectSelection {
  const values = selectionThumbs(selection, live);
  values[index] = clampTo(
    snapToQuarter(values[index]! + steps * QUARTER_MS),
    values[index - 1] ?? window.start,
    values[index + 1] ?? window.end,
  );
  return orderSelection(thumbsToSelection(values, live, selection), window);
}

/**
 * Cropping the timeframe from a row chart: `i` gives one end, `o` the other, a drag
 * across the trace gives both. One function because they are one gesture at different
 * degrees of completeness — the keys are a drag you make in two goes.
 *
 * Unsnapped, like the date fields below and unlike every drag on the timeline itself:
 * the instants were read off a trace under the pointer, and rounding them to the
 * quarter hour would crop somewhere other than where you pointed.
 *
 * A drag is taken as drawn, in either direction — uPlot reports left-to-right pixels,
 * but a caller that doesn't is answered rather than ignored. One end alone leaves the
 * other where it was, pushing it along only if the two would cross, which is exactly
 * what a typed bound does.
 *
 * The playhead is carried over and clamped by orderSelection, so it survives a crop it
 * still falls inside and is pulled to the nearest edge of one it doesn't.
 */
export function cropProjectSelection(
  crop: {start?: number; end?: number},
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection {
  const {start, end} = crop;
  if (start != null && end != null) {
    return orderSelection(
      {
        start: Math.min(start, end),
        end: Math.max(start, end),
        current: selection.current,
      },
      window,
    );
  }
  if (start != null) return setProjectBound('start', start, selection, window);
  if (end != null) return setProjectBound('end', end, selection, window);
  return selection;
}

// What a manual date/time field commits: the exact minute typed, never snapped —
// rounding what someone deliberately typed is worse than an unaligned bound. The
// opposite end is pushed along if the two would otherwise cross.
export function setProjectBound(
  which: 'start' | 'end',
  at: number,
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection {
  // The min/max is what pushes the opposite end along when the two would cross;
  // orderSelection then clamps both into the window.
  return orderSelection(
    which === 'start'
      ? {...selection, start: at, end: Math.max(selection.end, at)}
      : {...selection, start: Math.min(selection.start, at), end: at},
    window,
  );
}

// Re-exported so the project page, which is otherwise entirely in selection
// terms, doesn't have to reach into timeframe.ts for one constant.
export {MINUTE_MS};
