import {MINUTE_MS, clampTo, snapToQuarter} from './timeframe';

// A project page's selection: a sub-range of the project's window plus a cursor
// inside it. Lives in the URL as three ISO-UTC instants, the same encoding the
// device view's ?start/?end already uses.
//
// Everything here speaks epoch milliseconds, because it exists to drive a
// slider. Its sibling, timeframe.ts, speaks Date, because it exists to drive a
// database query. Neither unit is wrong for its job, so the two live apart
// rather than converting at every call — this import is the whole seam.

export type ProjectSelectionSearch = {
  start?: string;
  end?: string;
  current?: string;
};

// Shape-only, because validateSearch runs before the loader knows the project's
// window. Anything unparseable is dropped rather than rejected, so a mangled URL
// degrades to the default selection instead of 404ing.
export function parseProjectSelectionSearch(search: {
  start?: unknown;
  end?: unknown;
  current?: unknown;
}): ProjectSelectionSearch {
  const iso = (v: unknown) =>
    typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined;
  const out: ProjectSelectionSearch = {};
  const start = iso(search.start);
  const end = iso(search.end);
  const current = iso(search.current);
  if (start) out.start = start;
  if (end) out.end = end;
  if (current) out.current = current;
  return out;
}

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

// Everything the UI needs, clamped into the project window and ordered. Defaults
// are the whole window with the cursor at its start — deliberately not `now`,
// which would differ between the server render and the client and so would have
// to be a post-mount effect.
export function resolveProjectSelection(
  search: ProjectSelectionSearch,
  window: {start: number; end: number},
): ProjectSelection {
  const at = (v: string | undefined, fallback: number) =>
    v ? Date.parse(v) : fallback;

  const start = at(search.start, window.start);
  // orderSelection does the clamping and the ordering, so a hand-edited URL with
  // the ends swapped collapses the range rather than inverting it.
  return orderSelection(
    {start, end: at(search.end, window.end), current: at(search.current, start)},
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
    ? // The cursor is carried over, not discarded: it stays in the URL so turning
      // live off again returns to the instant you were last looking at.
      {start: thumbs[0]!, end: thumbs[1]!, current: previous.current}
    : {start: thumbs[0]!, current: thumbs[1]!, end: thumbs[2]!};

// Clamp into the window and restore start <= current <= end. The slider won't let
// thumbs cross, so this is a safety net for typed input and hand-edited URLs.
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

export function projectSelectionSearch(
  selection: ProjectSelection,
): Required<ProjectSelectionSearch> {
  return {
    start: new Date(selection.start).toISOString(),
    end: new Date(selection.end).toISOString(),
    current: new Date(selection.current).toISOString(),
  };
}

// Re-exported so the project page, which is otherwise entirely in selection
// terms, doesn't have to reach into timeframe.ts for one constant.
export {MINUTE_MS};
