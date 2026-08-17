import {
  MINUTE_MS,
  QUARTER_MINUTES,
  clampTo,
  snapToMinute,
  snapToQuarter,
} from './timeframe';

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

// `current` is null whenever nothing is pointing at the event: the playhead exists only
// while a pointer is over a row chart or over the timeline strip, and goes with it (see
// LevelTrace's setCursor hook and the timeline's onHoverMove). So it is not a position the
// page remembers between gestures — it is where the hand is, and a page nobody is pointing
// at has no instant, only a range.
//
// Which is what every reader downstream already had to handle: live mode has never had
// an instant either (see the project route's `viewedAt`), so a null here reaches the
// pins, the cards' readings and the playhead signal through the same path as a live page
// and needs nothing new of any of them.
//
// It need not be inside `start…end`, only inside the project's window: the two answer
// different questions. The crop says which stretch the charts draw and the Leqs average
// over; the playhead says where a hand is pointing, and the timeline strip can be pointed
// at end to end — the dim ground either side of the crop is still the evening. So an
// instant out there is read the way any other is: the readings come off the whole payload
// rather than the crop (see useProjectLogs), and a row chart whose axis has left it behind
// simply hides its line (see LevelTrace's positionPlayhead).
export type ProjectSelection = {
  start: number;
  current: number | null;
  end: number;
};

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
// nothing, the whole window with no cursor in it: an instant is what a pointer names, and
// there is no pointer on a page just arrived at. The first hover over a chart or the strip
// puts one there.
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
    chosen ?? {start: window.start, end: window.end, current: null},
    window,
  );
}

// The slider's thumbs, and back again: the crop's two ends, in order. The playhead is not
// among them and cannot be — it may now stand outside the crop (see the type above), and
// zag's thumbs are one ascending list, so a cursor between the bounds one moment and past
// them the next has no index to hold. It is drawn on the strip instead of being a thumb on
// it (see ProjectTimeline), which is also what lets a grip be dragged straight through it.
//
// Two functions rather than a pair of array literals, because they have to answer the same
// mapping in both directions and this is where that is stated once.
export const selectionThumbs = (selection: ProjectSelection): number[] => [
  selection.start,
  selection.end,
];

export const thumbsToSelection = (
  thumbs: number[],
  previous: ProjectSelection,
): ProjectSelection => ({
  start: thumbs[0]!,
  end: thumbs[1]!,
  // The cursor is carried over, not discarded: a grip dragged while nothing is hovered must
  // not invent one, and one the drag has swept past keeps the instant it was pointing at —
  // the crop moved, the hand did not.
  current: previous.current,
});

// Clamp into the window and restore start <= end. The slider won't let its two thumbs
// cross, so this is a safety net for typed input, and for an override made against a
// window that has since moved.
const orderSelection = (
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection => {
  const start = clampTo(selection.start, window.start, window.end);
  const end = Math.max(clampTo(selection.end, window.start, window.end), start);
  return {
    start,
    end,
    // No cursor stays no cursor: this orders a selection, and there is nothing here from
    // which to invent an instant nobody is pointing at.
    //
    // Held to the window and not to the crop, which is the whole of what "the playhead may
    // stand outside the window you picked" comes to in the rules: a crop dragged past the
    // instant being read leaves it where it is, rather than dragging it along by the edge
    // that swept over it.
    current:
      selection.current == null
        ? null
        : clampTo(selection.current, window.start, window.end),
  };
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
  const moved = (key: 'start' | 'end') =>
    next[key] === previous[key] ? next[key] : snapToQuarter(next[key]);
  return orderSelection(
    {
      start: moved('start'),
      end: moved('end'),
      // Nothing to snap: the cursor is no thumb of this slider's and no gesture that ends
      // here can have moved it (see thumbsToSelection, which carries it over verbatim). Where
      // it *is* set, it lands on the minute rather than on this grid — see setSelectionCurrent.
      current: next.current,
    },
    window,
  );
}

// What a press on the strip outside the crop commits: the nearer bound stretches out to meet
// it. zag's own rule for a press on a slider's track, kept because it is the right one — but
// held until the release, because until then the press might have been the start of a drag
// drawing a whole new window (see the timeline's endPress).
//
// The nearer of the two by which side it fell on, which is the same answer at half the
// arithmetic: a press outside the crop is either before the start or after the end.
//
// Through commitProjectSelection, so the release lands on the quarter-hour grid by the same
// rule a grip's release does — including "only what moved snaps", which is what keeps the
// bound this press does *not* claim off the grid if it was typed in by hand.
export function pressProjectBound(
  at: number,
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection {
  const which = at <= selection.start ? 'start' : 'end';
  return commitProjectSelection(
    setProjectBound(which, at, selection, window),
    selection,
    window,
  );
}

// The playhead moved and nothing else: what hovering a row chart commits — and, with
// `at` null, what leaving one commits. Both directions through one function, because
// "where the playhead is" is one rule and a pointer that has gone is as much an answer
// to it as a pointer that has moved.
//
// Takes the instant as it is given, and clamps nothing: the only bound left on a playhead is
// the project's window, and orderSelection is where that is held — every pick reaches it (see
// resolveProjectSelection), so a second clamp here could not be the one that decided anything.
// A caller that reads an instant off a pointer inside the window is already inside it.
//
// The bounds are untouched, so a crop survives being hovered over — and the crop is no bound
// on the cursor either: it may stand on the dim ground beyond either end (see the type above).
//
// Whether the instant is rounded is the caller's, and the two askers want different things: a
// row chart's hover names the sample under the pointer and must not be moved off it, while the
// timeline strip has no samples on it and rounds to the minute (see ProjectTimeline's
// withPlayheadAt). Which is why this takes an instant rather than a grid.
export const setSelectionCurrent = (
  selection: ProjectSelection,
  at: number | null,
): ProjectSelection => ({...selection, current: at});

// The grid the crop's two ends land on, in milliseconds: the keyboard's stride below, and the
// snap a release lands on above. Private, because a grid is a rule about where a bound may
// stand and every gesture that lands on one goes through this module.
const QUARTER_MS = QUARTER_MINUTES * MINUTE_MS;

// One end of the crop moved by whole grid steps: what an arrow or page key on the timeline
// commits. Read and written through selectionThumbs/thumbsToSelection like every other thumb
// gesture, so `index` means what it means to the slider and nowhere else.
//
// Snapped before it is clamped, so the first press off a bound typed as 18:07 lands
// on the grid rather than carrying that offset along for ever. Clamped to the other end
// after, where zag's own stepping stops too — the playhead is no part of this any more, and
// an edge stepped past it simply leaves it behind.
export function nudgeSelectionThumb(
  selection: ProjectSelection,
  {index, steps}: {index: number; steps: number},
  window: {start: number; end: number},
): ProjectSelection {
  const values = selectionThumbs(selection);
  values[index] = clampTo(
    snapToQuarter(values[index]! + steps * QUARTER_MS),
    values[index - 1] ?? window.start,
    values[index + 1] ?? window.end,
  );
  return orderSelection(thumbsToSelection(values, selection), window);
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
 * The playhead is carried over untouched: it marks where a hand was pointing, which cropping
 * elsewhere on the page does not move — and it no longer has to be inside the crop to be
 * anywhere at all (see ProjectSelection).
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

/**
 * A whole window drawn in one gesture: `anchor` is the instant a press named, `at` the one
 * the pointer has since reached. What dragging across the timeline strip commits, per frame
 * of the drag and once more on release — see ProjectTimeline's press handling.
 *
 * To the minute, and no coarser: the quarter-hour grid is what a *thumb* steps by, and a
 * window drawn freehand has no reason to be held to it — a drag is as precise as the hand
 * that made it, and rounding it would move the ends away from where they were let go. A
 * minute is where the resolving stops because that is what the loggers report and what every
 * readout prints (see snapToMinute).
 *
 * Which end comes out as `start` is not the press but the earlier instant — a drag leftwards
 * is answered rather than ignored, exactly as a sweep across a chart is.
 */
export function drawProjectSelection(
  {anchor, at}: {anchor: number; at: number},
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection {
  const from = snapToMinute(anchor);
  const to = snapToMinute(at);
  // Never an empty crop: on a narrow window a drag can be a real one — the strip only asks
  // once the pointer has travelled — and still land inside a single minute, and a window of
  // no width shows nothing anywhere on the page. So the far end takes a whole minute away
  // from the press instead, back the other way where that would leave the window, which is
  // the one direction a press at the very edge of it has room in.
  const step = at < anchor ? -MINUTE_MS : MINUTE_MS;
  const fits = (ms: number) => ms >= window.start && ms <= window.end;
  const far = to !== from ? to : fits(from + step) ? from + step : from - step;
  // No playhead while a window is being drawn: the two ends are what the gesture is saying,
  // and the hand is on one of them — a third mark standing at the same instant as a grip,
  // with a third readout over it, is clutter over the very thing being picked. The next hover
  // names a new one, wherever on the strip it happens.
  return cropProjectSelection(
    {start: from, end: far},
    {...selection, current: null},
    window,
  );
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
