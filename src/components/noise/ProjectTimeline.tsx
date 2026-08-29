import {Box, Slider as ChakraSlider} from '@chakra-ui/react';
import {memo, useEffect, useRef, useState} from 'react';
import {formatInstant, snapToMinute} from './timeframe';
import {
  commitProjectSelection,
  drawProjectSelection,
  nudgeSelectionThumb,
  pressProjectBound,
  selectionThumbs,
  setSelectionCurrent,
  thumbsToSelection,
  type ProjectSelection,
} from './projectSelection';
import {DRAG_MIN_PX, instantLabel} from './chartUtils';
import type {LogGap} from './logCoverage';
import {CHART_READOUT_STYLE} from './ChartTooltip';
import {TimelineMarkers} from './TimelineMarkers';
import {axisFraction} from './timelineTicks';

// The slider speaks epoch milliseconds, the same unit as everything it is handed,
// and steps one of them at a time. It has no unit of its own and so nothing to
// convert at: min and max are the window's own ends, and a thumb value *is* an
// instant.
//
// That is load-bearing, not tidiness. zag re-normalizes the controlled value on every
// update, snapping each thumb to a grid anchored on its *neighbour*
// (getValueRanges → snapValueToStep). Any value not already an exact multiple of the
// step gets moved, so on a coarser step an end the user never touched could be shifted by
// whatever the other end happens to be doing — a wobble on a thumb nobody is holding, and a
// crop that drifts off the minutes a drag drew it to. With the step at one millisecond every
// instant is on the grid by construction, so that normalization can only ever be a no-op.
//
// It also means there is no lossy round trip through a coarser unit: a thumb the user
// never touched comes back exactly as it went in, so commitProjectSelection can tell
// what actually moved. Both properties hold whatever the snap grid below becomes, and
// whatever resolution the logs are stored at.
const STEP_MS = 1;

// zag derives its keyboard stride from that same step, so how far a key press moves
// has to be stated here instead — a millisecond is a resolution, not a stride. In
// grid steps, which nudgeSelectionThumb turns into time: the grid every gesture on
// this page lands on belongs to projectSelection.ts, not to the slider.
const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  PageDown: -4,
  PageUp: 4,
};

// Milliseconds since the epoch make a poor aria-valuenow, and "minutes into the
// project" was no better — say the instant. Hoisted so the thumbs aren't handed a new
// closure on every frame of a scrub.
//
// Deliberately not the readout's format, which is the only place the two part company:
// that one drops the date once the crop is inside a day, because the strip under it
// says which day. Spoken aloud there is no strip, so it says the whole instant — and
// saying it the same way at every crop width is also what keeps this hoisted.
const ariaValueText = ({value}: {value: number}) => formatInstant(value);

// A crop window rather than a line with knobs: the strip is the whole pickable
// span, the lit part between the two grips is the selection, and everything
// outside it is dimmed. Two thumbs, and only two: the playhead is drawn on the strip rather
// than being a thumb on it (see PLAYHEAD_W), because it may stand outside the crop and zag's
// thumbs are one ascending list.
//
// The grips sit *outside* the lit range rather than centred on its ends — the start
// one finishes where the range begins, the end one begins where it finishes — so the
// playhead can stand on either edge and still be seen. Three pieces make that hold:
//
//  · The value axis is inset by one grip width at each end, as padding on the root.
//    That padding shrinks the control, which is the box zag measures, so the ends of
//    the axis leave exactly the room a grip needs. The track is pulled back out over
//    the padding (mx below) so the strip itself still spans the full width.
//  · Alignment is "center", so a thumb's offset is the plain value percentage — which
//    is what lets the crop's two layers be laid out in that same percentage and abut
//    the thumbs exactly (see CROP_SPAN). ("contain" insets the thumbs but not those, so
//    under it the two would disagree by up to half a thumb.)
//  · Each thumb's box is the one-pixel column its value occupies, and a grip hangs
//    off the side of it. zag centres a thumb with a translate of its own width, so the
//    playhead's own mark can be placed by the same two rules — a left of its value
//    percentage, then back half its width — and land in the very same column a thumb would.
const STRIP_H = 44;
const HANDLE_W = 12;
const PLAYHEAD_W = 1;

// The hairline around the strip, and the one the lit window is banded with. One constant
// because the second is positioned by the first: the band draws on the inner edge of the
// frame, so the range has to be inset by exactly the frame's own width to have an inner
// edge at all.
const FRAME_W = 1;

// Where the crop's two layers — the wash and the band over it — begin and end.
//
// Off the pair of custom properties zag keeps the range's own ends in, which it sets on
// the Root: so both follow the selection without recomputing it, and cannot come out a
// rounding apart from each other.
//
// Read where their percentages resolve against the *Control*, which is the axis the thumbs
// are placed on — so a layer ends exactly on the thumb it is drawn to. That is the whole
// reason neither of these is `Slider.Range` any more. zag makes the track
// `position: relative`, so a range inside it resolves the same two percentages against the
// track's box instead, and the track is pulled a grip's width past the axis at each end
// (mx below). Same fraction of a box 22 px wider: the ends land up to 11 px off the thumbs
// they are supposed to meet, out by nothing in the middle of the strip and by the whole of
// it at either end. On the far side of centre that overshoots, which a grip hides; on the
// near side it falls short, which is a gap of bare toolbar between the wash and the grip.
//
// Half a pixel out at each end, because a thumb marks a one-pixel column and a layer has
// to cover the whole of the two it ends on — otherwise the playhead standing on one would
// half hang out of the lit part, and the grip that abuts it would clip that half.
const CROP_SPAN = {
  left: 'var(--slider-range-start)',
  right: 'var(--slider-range-end)',
  mx: '-0.5px',
} as const;

// Each grip carries its own readout, hidden until it is being pointed at or moved:
// three pills standing open over a 44 px strip would cover the very thing they label,
// and while dragging one the other two are not what anyone is reading. Hoisted, so
// Emotion hashes it once rather than per frame of a scrub.
//
// Four ways for a grip to be "now": hovered, dragged by zag (which flags the thumb it is
// moving), stepped with the keyboard (focus-visible, so the value is readable while
// arrowing), and carried by a drag drawing a new window, which zag knows nothing about —
// hence data-moving below. The playhead's own pill is not one of these: it is not a thumb,
// and it stands for as long as there is a playhead at all (see Readout).
const READOUT_ATTR = 'data-readout';
// Hoisted for the same reason the CSS below is, and because a computed key would otherwise
// have a fresh object built for every pill on every frame of a scrub.
const READOUT_MARK = {[READOUT_ATTR]: ''} as const;
const READOUT_CSS = {
  [`& [${READOUT_ATTR}]`]: {display: 'none'},
  [`&:hover [${READOUT_ATTR}], &[data-dragging] [${READOUT_ATTR}], &[data-focus-visible] [${READOUT_ATTR}], &[data-moving] [${READOUT_ATTR}]`]:
    {display: 'block'},
} as const;

// What the pills print: read the same way the row charts' tooltip reads it, off the same rule
// — a hover writes both at once, and one of them saying 22:15 while the other says
// Sa 09.08. 22:15 would read as two different instants.
//
// One closure for the file rather than one per render: `live` is deliberately absent from this
// component (see below), so there is nothing here for it to close over, and a fresh function
// per render would be a fresh string handed to every pill on every frame.
const labelFormat = instantLabel(false);

/**
 * What a mark stands on, in a pill over the strip, absolutely positioned on that mark's own
 * column so it follows the mark without anything being measured.
 *
 * Its left edge starts at the mark and it is then pulled back by its own width in proportion
 * to how far along the strip the mark is — which is the whole of what `fraction` is: centred
 * in the middle (-50 %), flush right of a mark at the far left (0 %), flush left of one at the
 * far right (-100 %). That one expression is the clamping — a pill narrower than the strip
 * cannot leave it at any position, and it never stops pointing at its own mark the way a hard
 * clamp would. The same trick, for the same reason, as ChartTooltip's. Inline, because it
 * changes per frame of a drag and a style prop would have Emotion hash a class for each one.
 *
 * A fraction and a string, and nothing about time: three of these render per frame of a
 * gesture and two of them are usually standing still, so memo is what keeps their formatting
 * and Emotion's serialization off those frames — which needs props that don't change identity
 * when the page merely re-renders.
 *
 * One component for the grips and the playhead alike. The two differ in when they show: a
 * grip's is a child of its thumb and left to READOUT_CSS, which opens it only while that grip
 * is pointed at or moving, and the playhead's stands for as long as there is a playhead — the
 * mark outlives the hand that placed it, and a parked hairline with no instant on it is not
 * something anyone can come back to. The marker attribute is set on both regardless, since it
 * is what that CSS (and the thumb's focus ring) selects on.
 */
const Readout = memo(function Readout({
  fraction,
  children,
}: {
  fraction: number;
  children: string;
}) {
  return (
    <Box
      {...READOUT_MARK}
      {...CHART_READOUT_STYLE}
      position="absolute"
      bottom="100%"
      mb="1"
      left="50%"
      pointerEvents="none"
      zIndex="4"
      style={{transform: `translateX(-${fraction * 100}%)`}}
    >
      {children}
    </Box>
  );
});

/**
 * At most one commit per animation frame, keeping only the newest value.
 *
 * A pointer can report several moves per frame and a display can show only one, so
 * the extra renders are pure waste. Coalescing here — rather than deferring the work
 * downstream — is deliberate: a transition-priority render (useDeferredValue) is
 * abandoned and restarted whenever the next move arrives, so under a continuous drag
 * it commits in bursts or not at all. Every commit this makes renders synchronously
 * and lands, which puts the page in lockstep with the thumb.
 */
function useFrameCommit(onCommit: (selection: ProjectSelection) => void) {
  const pending = useRef<ProjectSelection | null>(null);
  const frame = useRef<number | null>(null);

  const cancel = () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
  };
  useEffect(() => cancel, []);

  return {
    onFrame: (selection: ProjectSelection) => {
      pending.current = selection;
      if (frame.current != null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const next = pending.current;
        pending.current = null;
        if (next) onCommit(next);
      });
    },
    // A release, or a click: drop whatever is queued first, so a coalesced value
    // can't land *after* the snapped one and undo it.
    onceNow: (selection: ProjectSelection) => {
      cancel();
      onCommit(selection);
    },
  };
}

// The right-hand end of the value axis, which is the window's own — except on a window
// with no width at all. A project that hasn't started collapses to a point (see
// visibleProjectWindow), and every fraction on this strip is a division by the span: zag
// would divide by it too, and axisFraction would hand back a NaN to place a mark at. One
// step wide instead, which nothing can be picked in either way.
const axisEnd = (window: {start: number; end: number}) =>
  Math.max(window.end, window.start + STEP_MS);

// The instant a pointer sits over, unsnapped. Mirrors zag's own point→value math, which
// the crop strip's handlers bypass: under thumbAlignment="center" the axis is the
// measured element's own box, with no inset of its own — the room the grips need is
// padding on the element outside it, and so already outside this box. Unsnapped because
// the first thing a press decides is which side of an edge it is on, and on a narrow
// window the grid would answer that wrong.
//
// The two ends as numbers rather than the window object, because the axis' right-hand end
// is `axisEnd` above and not `window.end` — passing the window would invite the caller to
// think otherwise.
const instantAt = (
  control: HTMLElement,
  clientX: number,
  start: number,
  end: number,
): number | null => {
  const {left, width} = control.getBoundingClientRect();
  if (width <= 0) return null;
  // The same normalization the markers and the readout use, asked in pixels: where
  // the pointer stands between the control's two edges.
  const ratio = axisFraction(clientX, left, left + width);
  return start + ratio * (end - start);
};

// The selection with its playhead moved to an instant the pointer named. To the minute, like
// the window a drag draws (see drawProjectSelection): nothing snaps a pointer to the
// quarter hour on this strip any more, and a mark that stepped in quarters while the same
// hover over a row chart slid smoothly would be two answers to one question.
//
// An instant and never nothing. The pointer leaving used to call this with a null and the mark
// went with the hand; it stays now, because it says which instant the page is reading rather
// than where a hand happens to be — which is what lets you point at a peak, take the hand off
// the strip, and read the cards and the pins for it. The one gesture that takes it away is a
// window drawn in a single drag, which states a timeframe with no instant in it (see
// drawProjectSelection).
//
// setSelectionCurrent is the page's one rule for where the cursor may stand — the same call
// the row charts' hover goes through. The window is its bound, not the crop: the strip can be
// pointed at end to end.
const playheadAt = (selection: ProjectSelection, ms: number) =>
  setSelectionCurrent(selection, snapToMinute(ms));

/**
 * The instant the page is reading, drawn across the strip: a hairline the full height of
 * it, so it reads as a position in time rather than a draggable edge. The same width and
 * the same near-white as the one the row charts draw (see LevelTrace's CHART_CSS): one
 * instant, standing in several places at once, and it should be recognisably the same mark
 * in each of them. On the crop strip it is the grips' yellow that tells it apart from an edge.
 *
 * Drawn rather than dragged, which is the whole reason it is not one of the crop's thumbs:
 * it may stand outside the crop, and zag's thumbs are one ascending list — an edge could
 * never be dragged *through* a thumb, whatever the collision behaviour. Nothing is lost in
 * the trade, because a hover already places it anywhere on the strip and a press anywhere
 * in the crop does too, so there was never anything a hand had to take hold of.
 *
 * Placed by the two rules zag places a thumb by — a left of its value percentage, then back
 * half its own width — so it lands in exactly the column a thumb would have. As a negative
 * margin rather than a translate, deliberately: a transform would make this a stacking
 * context, and the readout inside it needs to stand above the strip's own layers rather
 * than above this hairline's. The percentage is inline, because it changes per frame of a
 * hover and a style prop would have Emotion hash a class for each one.
 *
 * No z-index, so the crop strip's thumbs (the recipe gives them 2) pass over it: a mark
 * parked against an edge must not draw over the thing that moves that edge. And
 * pointerEvents none, so the strip under it goes on answering the hover that is carrying it.
 */
function Playhead({
  fraction,
  label,
}: {
  fraction: number;
  // What the pill over the mark says. Always something: the mark stays where it is put, so it
  // is read with the hand off the strip at least as often as under it, and a hairline with no
  // instant on it is not a thing anyone can park and come back to. A grip's pill is hidden by
  // READOUT_CSS instead, a grip being something you take hold of rather than a reading.
  label: string;
}) {
  return (
    <Box
      position="absolute"
      top="0"
      bottom="0"
      w={`${PLAYHEAD_W}px`}
      ml={`-${PLAYHEAD_W / 2}px`}
      bg="chart.playhead"
      pointerEvents="none"
      style={{left: `${fraction * 100}%`}}
    >
      <Readout fraction={fraction}>{label}</Readout>
    </Box>
  );
}

// What the strip is handed, in both of its forms. Stated once because the two differ by
// exactly one prop and everything else about them is the same toolbar.
type TimelineProps = {
  // The pickable window, which is not the project's own: it stops at the current
  // time while the event is still running (see visibleProjectWindow) — which the
  // strip shows by simply ending there.
  window: {start: number; end: number};
  selection: ProjectSelection;
  // The stretches of the event nobody reported in, shaded behind the ticks so the strip
  // says where there is anything to look at as well as when. Straight through to
  // TimelineMarkers, which is the layer that draws in the axis' own coordinates.
  gaps?: readonly LogGap[];
  onCommit: (selection: ProjectSelection) => void;
};

/**
 * The project page's second toolbar: the evening as a strip, with the cursor that says
 * which instant the page is reading drawn on it — and, where the view has any use for one,
 * the crop that says which stretch of it the charts draw.
 *
 * Mounted only while scrubbing. Live mode reads what is arriving now, which is neither
 * a range nor an instant anyone picked, so the page leaves this out entirely rather
 * than showing a strip with nothing to point at — hence no `live` anywhere below.
 *
 * The strip is the whole component: what a mark stands on is read off the mark itself
 * (see Readout) rather than from a line of text beside it. The two date fields that used
 * to sit under it are gone — every instant they set can be dragged, and a toolbar is not
 * where a form belongs.
 *
 * `onCommit` fires as a gesture moves rather than on release, so the page follows the
 * pointer; see useFrameCommit for the rate that happens at.
 */
export function ProjectTimeline({
  croppable,
  ...props
}: TimelineProps & {
  // Whether the strip offers the crop as well as the playhead. The list's charts are drawn
  // over the crop and their Leqs averaged across it, so there it is half of what the
  // toolbar is for; the map has no charts — a pin shows what stood there at the playhead,
  // read off the whole payload and not the crop (see useProjectLogs) — so a window picked
  // there would change nothing on screen.
  //
  // Decided by the view and passed down rather than read off the route here, because the
  // strip belongs to the layout and the layout is the one place that knows which view is
  // up. What is picked survives the switch either way: the selection is the layout's, so
  // the crop is still there when the list comes back.
  croppable: boolean;
}) {
  return croppable ? <CropTimeline {...props} /> : <ScrubTimeline {...props} />;
}

/**
 * The full strip: two thumbs on one track, and the playhead drawn between or beside them.
 *
 * Three gestures, and every one of them a pointer on the strip: each grip drags its own end;
 * a drag anywhere else draws a whole new window between where it started and where it is let
 * go (see onControlPointerDownCapture); and simply pointing at the strip — hovering it, or
 * tapping inside the crop — puts the cursor on an instant, anywhere from one end of the
 * evening to the other, and leaves it standing there once the hand has gone. A press only
 * becomes the second of those once it has actually travelled, so a click stays the click it
 * has always been.
 */
function CropTimeline({window, selection, gaps, onCommit}: TimelineProps) {
  // The axis' right-hand end, which is also the slider's max — see axisEnd for the one
  // window where that is not `window.end`.
  const sliderMax = axisEnd(window);

  // Every gesture commits as it moves, so `selection` is the only truth there is —
  // there is no in-flight copy to preview from. It used to be one: while the
  // timeframe lived in the URL, committing per pointer move meant a navigation and a
  // refetch per move, so the drag showed a local preview and committed on release.
  // The whole event is in the browser now, so the views can simply follow.
  const thumbs = selectionThumbs(selection);
  const {onFrame, onceNow} = useFrameCommit(onCommit);

  // Whether the press in flight has become a window being drawn — which carries both grips at
  // once, and is the one gesture on this strip zag knows nothing about, so its grips have to
  // be told to show their readouts (zag flags only the thumb it drags itself).
  //
  // It used to name the other thing a press can be as well, a scrub, and there was a second
  // flag beside it for a mouse merely hovering. Both were only ever read to decide whether to
  // show the playhead's pill, and that pill now stands whenever there is a playhead: the mark
  // outlives the hand, so whether a hand is on the strip has stopped being a question this
  // component has to answer.
  //
  // State and not the ref below, because it is read while rendering; set twice per gesture,
  // not per move.
  const [drawing, setDrawing] = useState(false);

  // The press in flight, if any. One record and not two, because a scrub and a drawn window
  // are the same press at different degrees of commitment: it is only once it has travelled
  // DRAG_MIN_PX that anyone knows which of the two it was.
  //
  // A ref because it gates the pointerdown handler synchronously, and what renders from a
  // press — the readouts — is the state above.
  const press = useRef<{
    pointerId: number;
    // The instant under the press, unsnapped: one end of the window being drawn, and on a
    // release that never dragged, the instant a click named.
    anchor: number;
    // Where it landed, which is the only thing the drag threshold can be measured against.
    originX: number;
    // Whether that threshold has been crossed. Once it has, this press draws a window and can
    // no longer become a click. Here as well as in the state above, because the move handler
    // reads it synchronously, several times per frame.
    drawing: boolean;
  } | null>(null);

  // The strip's two shared rules, bound to this axis and this selection — see instantAt
  // and playheadAt for what each of them is.
  const pointerAt = (control: HTMLElement, clientX: number) =>
    instantAt(control, clientX, window.start, sliderMax);

  const withPlayheadAt = (ms: number) => playheadAt(selection, ms);

  // Where along the strip an instant stands, 0…1: what places a mark and pulls its readout
  // back over it. Against sliderMax rather than window.end, because that is the axis the
  // thumbs are on — see the note above CROP_SPAN.
  const fractionOf = (ms: number) => axisFraction(ms, window.start, sliderMax);

  // Whether an instant falls strictly inside the lit window. Not a rule about the playhead
  // any more — that may stand anywhere on the strip — but about what a *press* means: inside
  // the crop it points at an instant, outside it takes hold of the nearer edge (see
  // endPress). Open at both ends, so a press on the very bound moves that bound rather than
  // doing nothing.
  const insideCrop = (at: number) => at > selection.start && at < selection.end;

  // Every press on the strip is taken over here — none of them reach zag any more.
  //
  // Because a press is now the start of a window: dragging draws the whole crop in one
  // gesture, from where it went down to wherever it is let go (see onControlPointerMove).
  // That has to be true of the dim ground as much as of the lit part, so zag's own track
  // rule — the nearest thumb jumps to the pointer, whatever the press was going to become —
  // cannot be left in place anywhere. What it did for a *click* is worth keeping, though, so
  // the release below still does it (see endPress).
  //
  // A press that never travels keeps meaning exactly what it meant before: inside the
  // window it places the playhead, which is also the whole touch gesture for pointing at an
  // instant — a finger cannot hover, and a mouse gets there without pressing at all (see
  // onControlPointerMove). Outside it, nothing is committed yet: what a press on the dim
  // ground meant is only known once it is released or has moved.
  //
  // Capture phase, since zag's own handler sits on this element and would
  // otherwise run first.
  const onControlPointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    // A grip drags itself; its pointerdown passes through here on its way down, and
    // stealing it would freeze it. The playhead needs no such exception — it is drawn
    // rather than dragged, and takes no pointer events at all.
    if ((event.target as HTMLElement).closest('[role="slider"]')) return;

    const control = event.currentTarget;
    const at = pointerAt(control, event.clientX);
    if (at == null) return;

    event.preventDefault();
    event.stopPropagation();
    // One at a time: a second finger landing on the strip would otherwise start its own
    // and fight the first over the same window.
    if (press.current != null) return;

    press.current = {
      pointerId: event.pointerId,
      anchor: at,
      originX: event.clientX,
      drawing: false,
    };
    if (insideCrop(at)) {
      // The playhead goes where the press landed, as it always has — and stays there when the
      // finger lifts, which is the whole of how a mark is parked by touch. A drag from here
      // redraws the window instead and takes it away again; until then this is a tap pointing
      // at an instant, and pointing at it is the whole answer.
      onceNow(withPlayheadAt(at));
    }
    // Pointer capture retargets every subsequent move and the release to the strip,
    // so a drag that wanders off it — off the page entirely — keeps tracking, and
    // the release still arrives at the handlers below. It also means those can be
    // ordinary React props on the same element: no listeners to add, and so none
    // that could outlive the gesture and go on following the pointer.
    control.setPointerCapture(event.pointerId);
  };

  // The press in flight if this event belongs to it, and null otherwise — which is one test
  // stated once, for the two handlers that ask it. zag drags its own thumbs off document
  // listeners, so its gestures pass through here with `press` unset.
  const ownPress = (event: React.PointerEvent) =>
    press.current?.pointerId === event.pointerId ? press.current : null;

  // A mouse over the strip carries the playhead with it, no press involved: what the strip is
  // mostly used for is reading the evening, and the charts under it already answer a plain
  // hover that way (see LevelTrace's setCursor).
  //
  // The whole strip, dim ground included: the crop says which stretch the page is *showing*,
  // and pointing at a minute outside it is still pointing at the evening — the readings for
  // it are in the browser either way (see ProjectSelection). So the mark follows the pointer
  // from one end of it to the other, and stays on the last minute it was carried to.
  //
  // `buttons === 0` is the whole of how a mouse is told from a finger, and there is
  // deliberately no pointerType test or media query anywhere here: a touch pointer only
  // ever moves while it is down, so a move with nothing held is a hover by construction.
  // The same test is what keeps this out of the way of a drag — zag moves its grips off
  // document listeners, but the pointer is still over this control while it does.
  const onHoverMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 0) return;
    const at = pointerAt(event.currentTarget, event.clientX);
    // Only a strip with no width to measure, which is nowhere to point at.
    if (at == null) return;
    onFrame(withPlayheadAt(at));
  };

  // There is no pointerleave handler, and that absence is the feature: the playhead is the
  // instant the page is reading rather than the pixel a hand is on, so a pointer going away
  // says nothing about it. What used to be here took the mark down and left "no readings" as
  // the page's resting state, which meant a peak could be pointed at but never studied — the
  // numbers emptied on the way to reading them.
  //
  const onControlPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const own = ownPress(event);
    if (!own) return onHoverMove(event);
    // Nothing is holding the strip any more: a release we never saw, because the browser
    // took the capture away mid-gesture. Finish where it stands rather than following an
    // empty pointer — and clear the gate, or no later press can start.
    if (event.buttons === 0) return endPress();
    const next = pointerAt(event.currentTarget, event.clientX);
    if (next == null) return;

    if (!own.drawing) {
      // Still a click as far as anyone can tell. Nothing happens inside the threshold — the
      // press has already had its say, and moving the playhead a pixel on the way to a drag
      // that then throws it away is motion for its own sake.
      if (Math.abs(event.clientX - own.originX) < DRAG_MIN_PX) return;
      own.drawing = true;
      // Which is also the end of the playhead's pill: a window being drawn has no playhead at
      // all (see drawProjectSelection), so there is nothing left for it to name.
      setDrawing(true);
    }

    // Both ends at once, from where the press landed to where the pointer is now: a redraw
    // states the whole window, so nothing of what was picked before is read here — which is
    // also why it does not matter that `selection` is a frame old under a fast drag.
    //
    // To the minute rather than to the grid the grips step by, so the ends stay where the
    // hand left them (see drawProjectSelection) — and so the release has nothing left to
    // move, which is why there is no snapping pass at the end of this gesture as there is at
    // the end of zag's.
    onFrame(
      drawProjectSelection({anchor: own.anchor, at: next}, selection, window),
    );
  };

  // The end of a press, whatever it turned out to be. A drawn window has committed every
  // frame of itself already and needs nothing here; what is left is the click, which is only
  // a click at this point — nothing before the release can tell one from the start of a drag.
  const endPress = () => {
    const own = press.current;
    press.current = null;
    setDrawing(false);
    if (!own || own.drawing) return;
    // A click inside the window placed the playhead as it went down, and that is all it ever
    // did. Outside it, the nearer edge stretches out to meet the pointer — zag's own track
    // rule, which its handler no longer gets to run, so pressProjectBound is where it lives
    // now, alongside the drawn window's own rule and on the same grid a grip's release lands
    // on.
    if (insideCrop(own.anchor)) return;
    onceNow(pressProjectBound(own.anchor, selection, window));
  };

  const onControlPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (ownPress(event)) endPress();
  };

  return (
    <ChakraSlider.Root
      min={window.start}
      max={sliderMax}
      step={STEP_MS}
      value={thumbs}
      // Straight through as the thumbs move: a value zag hands over is already an
      // instant, so the thumb stays under the pointer and a thumb that didn't move
      // comes back untouched.
      onValueChange={(e) => onFrame(thumbsToSelection(e.value, selection))}
      // The wall-clock snap lands once, on release. Doing it per move would pull
      // each value off the grid zag is computing from — the thumb would sit up to
      // half a step away from the pointer for the whole drag, on a project whose
      // window doesn't start on a quarter hour.
      onValueChangeEnd={(e) =>
        onceNow(
          commitProjectSelection(
            thumbsToSelection(e.value, selection),
            selection,
            window,
          ),
        )
      }
      getAriaValueText={ariaValueText}
      // One end dragged past the other takes it along, rather than stopping dead against it:
      // a crop can be narrowed to nothing and reopened from there without letting go. Fixed,
      // where it used to be set per drag — the playhead was the thumb that had to stop at its
      // neighbours instead of pushing them, and it is no longer a thumb.
      thumbCollisionBehavior="push"
      // The grip width, held back at each end: it shrinks the control, and so the
      // axis, leaving the room a grip standing outside the range needs. The track
      // reaches back over it, so nothing about the strip moves — only the span its
      // ends can be dragged to.
      px={`${HANDLE_W}px`}
      // Every thumb sits at its plain value percentage, which is the coordinate the
      // range is laid out in too. See the note above the constants for what rests
      // on that.
      thumbAlignment="center"
      // One label per thumb, and the thumbs are the crop's two ends. The playhead used to be
      // a third: it is drawn on the strip now, and a cursor that exists only while a hand is
      // on the strip is not something a screen reader can be handed a slider for.
      aria-label={['Start', 'End']}
    >
      <ChakraSlider.Control
        height={`${STRIP_H}px`}
        // The whole strip, not just the lit part: a drag anywhere on it draws a window, so the
        // dim ground either side is as pickable as the crop is, and the crosshair the wash
        // already carries is the same gesture said in the same way. The grips keep their own
        // ew-resize over it, the playhead its crosshair.
        cursor="crosshair"
        onPointerDownCapture={onControlPointerDownCapture}
        onPointerMove={onControlPointerMove}
        onPointerUp={onControlPointerUp}
        onPointerCancel={onControlPointerUp}
        // Fires on the ordinary release and whenever the browser takes the capture
        // away, so it is the one signal a press can't end without.
        onLostPointerCapture={onControlPointerUp}
      >
        {/* Outside the selection: the span you could pick, left as the toolbar's own
              ground and merely outlined. Nothing is drawn there because nothing is
              *there* — the lit window is the figure, and giving the rest a fill of its
              own made the strip a second bar competing with it. Back out over the root's
              padding, so the strip is the whole window even though the axis inside it
              stops a grip short of either end. */}
        <ChakraSlider.Track
          h="full"
          rounded="md"
          // Both of the recipe's own track decorations, cleared: its `outline` variant
          // brings a fill *and* an inset one-pixel ring (shadows.inset is literally
          // `inset 0 0 0 1px black/5`). This strip supplies its own frame below, and the
          // ring sat just inboard of it as a second, barely-visible border.
          bg="transparent"
          shadow="none"
          // The same hairline the ticks are drawn in, so the frame and the grid it
          // frames read as one thing — and so a day mark running into the top or bottom
          // edge simply continues the line rather than crossing it. Opaque for that
          // reason: see TimelineMarkers. The crop's wash is held a frame's width inside
          // it, so the rule stays visible all the way round however the window is cropped.
          borderWidth={`${FRAME_W}px`}
          borderColor="chart.rule"
          mx={`-${HANDLE_W}px`}
        />

        {/* Inside it: the window, from the first thumb to the last — which is start→end
            whether or not the playhead sits between them.
            The same wash the row charts lay under their traces — see LevelTrace's `fill()`,
            which is a line's own colour at 15 %. Fixed, and there is not even a stroke to
            follow any more: the charts draw a line per picked window, each its own shade, so
            a strip that took one of them would be picking a favourite. `accent.solid` is the
            section's one accent — the grips' own fill, and the middle of the series ramp —
            so the crop reads as belonging to the handles that set it.

            Before the markers, so the grid draws over the top of it: a tick inside the crop
            stays the same crisp hairline it is outside, rather than something seen through
            15 % yellow. Which is also why the wash and the band below are two boxes and not
            one — the band has to be over the grid, and the wash under it.

            Translucent, unlike everything else here, and safely so: held a frame's width
            inside the strip top and bottom, so it stops short of the rule around it and has
            nothing to double up against. The crop's two accent edges are the band below, out
            where they can reach that rule — this is only the fill.

            Hit-testable, and the one thing here that is: this is the lit part, and pointing
            at it is pointing at the window — a mouse here need not press at all (see
            onHoverMove). No cursor of its own any more: the crosshair the row charts carry is
            on the control now, because a drag draws a window from anywhere on the strip and
            not only from the lit part. */}
        <Box
          position="absolute"
          top={`${FRAME_W}px`}
          bottom={`${FRAME_W}px`}
          {...CROP_SPAN}
          bg="accent.solid/15"
        />

        {/* The clock the strip is read against. Must stay between the track and the
            thumbs — see TimelineMarkers for what rests on that. Handed sliderMax rather
            than window.end: that is the axis the thumbs are on, and a marker measured
            against anything else would stand beside the thumb that shares its instant.
            The grip width too, which is how far the strip reaches past that axis at either
            end — the room the outermost labels are cut against rather than pulled in. */}
        <TimelineMarkers
          start={window.start}
          end={sliderMax}
          gaps={gaps}
          overhang={HANDLE_W}
        />

        {/* The crop, banded top and bottom in the grips' own fill: the grips run the full
            height of the strip, and these two lines are what carries the accent between
            them, so the window reads as a closed figure rather than a wash with handles at
            its ends. Opaque, and drawn *on* the frame rather than inside it — along the
            crop the strip's own rule turns accent, which is why there is no line of the
            frame's colour left showing under it.

            Which is why it is out here and not a border on the wash. That box is held
            inside the frame, and a line drawn on its edge is therefore always a pixel short
            of the strip's — and the ticks, being between the two, punched a grey hole
            through it at every crossing besides. Here it is after the markers and before
            the thumbs, so tree order alone puts it over the grid and under both grips and
            the playhead, and no z-index is needed anywhere.

            Spanning the crop exactly as the wash does, off the same two properties — see
            CROP_SPAN. Top and bottom to nothing, unlike the wash: these two lines are the
            frame's own rows, which is what "drawn on the frame" means. */}
        <Box
          position="absolute"
          top="0"
          bottom="0"
          {...CROP_SPAN}
          borderTopWidth={`${FRAME_W}px`}
          borderBottomWidth={`${FRAME_W}px`}
          borderColor="accent.solid"
          // Decorative, and over the very part of the strip a scrub starts in: the crop is
          // already spoken by the two edge thumbs, and a box that took pointerdown here
          // would stop a press from placing the playhead.
          pointerEvents="none"
          aria-hidden
        />

        {/* Where the page is reading, drawn between or beside the grips — see Playhead. Here
            in the tree so the markers are under it and the thumbs, carrying the recipe's own
            z-index, are over it.

            With its pill whenever it is there at all, pointed at or not. It was shown only
            while a hand was on this strip, on the grounds that a pill naming an instant the
            hand is nowhere near says nothing — but the mark stays where it is put now, and the
            reason to park one is to read it, so the instant has to be legible with the hand
            out of the way. The one case with no pill is a window being drawn, which has no
            playhead to name (see drawProjectSelection). */}
        {selection.current != null && (
          <Playhead
            fraction={fractionOf(selection.current)}
            label={labelFormat(selection.current)}
          />
        )}

        {thumbs.map((value, i) => {
          const start = i === 0;
          return (
            <ChakraSlider.Thumb
              key={i}
              index={i}
              // Set while a drag is drawing a new window, which carries both ends at once from
              // off the strip: it is their two instants that are being picked, and a window
              // redrawn with no times on it says nothing about what you are picking. zag flags
              // the thumb it drags itself, but it has no part in this gesture.
              data-moving={drawing || undefined}
              css={READOUT_CSS}
              // Neutralize the default round knob; these are grips, drawn by the
              // bracket below.
              bg="transparent"
              borderWidth="0"
              boxShadow="none"
              rounded="none"
              // The one-pixel column the value occupies. A grip hangs off the side of
              // that box and brings its own hit area with it.
              width={`${PLAYHEAD_W}px`}
              height={`${STRIP_H}px`}
              display="flex"
              alignItems="center"
              justifyContent="center"
              // Over the strip's own crosshair: a grip is the one thing here that is taken hold
              // of rather than pointed at.
              cursor="ew-resize"
              // Capture, because zag's own key handler sits on this element and bails
              // on an event that has already been defaulted, so preventing it here is
              // what replaces its one-millisecond stride. Keys it isn't given — Home,
              // End — still reach it untouched.
              onKeyDownCapture={(event) => {
                const steps = KEY_STEPS[event.key];
                if (steps == null) return;
                event.preventDefault();
                onceNow(
                  nudgeSelectionThumb(selection, {index: i, steps}, window),
                );
              }}
              // The bracket takes the focus ring's colour — everything drawn in this
              // box except the readout, which is a pill of its own and would
              // otherwise turn blue along with the thing it labels.
              _focusVisible={{
                outline: 'none',
                [`& > *:not([${READOUT_ATTR}])`]: {bg: 'accent.focusRing'},
              }}
            >
              <ChakraSlider.HiddenInput />
              <Readout fraction={fractionOf(value)}>
                {labelFormat(value)}
              </Readout>
              {/* A trim bracket, the full height of the strip, so the window's
                  edge is something you can obviously take hold of. Alongside its
                  thumb rather than around it: the range starts at the column the
                  thumb marks, so this ends where the range begins, and the two
                  meet without either covering the other. Rounded on the outer
                  side only, for the same reason — and to the strip's own radius,
                  so an uncropped window reads as one bar with its ends held. */}
              <Box
                position="absolute"
                top="0"
                {...(start
                  ? {right: '100%', roundedLeft: 'md'}
                  : {left: '100%', roundedRight: 'md'})}
                w={`${HANDLE_W}px`}
                h="full"
                bg="accent.solid"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {/* Its own hue rather than a neutral, so the notch stays legible
                      on the yellow at the same contrast the grey pair had. */}
                <Box w="2px" h="14px" rounded="full" bg="accent.800" />
              </Box>
            </ChakraSlider.Thumb>
          );
        })}
      </ChakraSlider.Control>
    </ChakraSlider.Root>
  );
}

/**
 * The same strip with the crop taken out of it: a clock you point at, and nothing to pick.
 *
 * What the map wants of the timeline. A pin has room for one number and shows what stood
 * at that place at the playhead, read off the whole payload rather than the crop — so the
 * crop changes nothing the map draws, and two grips sitting over it would be a control for
 * the other view. What it does still want is the playhead itself, because that is the
 * question the map cannot answer on its own: which moment the pins are showing.
 *
 * Not the crop strip with its thumbs hidden. With nothing to drag there is no slider left
 * — a zag root with an empty value list is a range control speaking about a range nobody
 * can reach, and a hidden thumb is still one a keyboard finds. What is left is a box that
 * takes pointers, which is what this is.
 *
 * Its geometry is deliberately the crop strip's, to the pixel: the same inset at each end,
 * the same frame pulled back out over it, the same overhang the outermost tick labels are
 * cut in. The toolbar belongs to the layout and stays mounted across a view switch, so an
 * axis that moved a grip's width when the map came up would slide the whole evening —
 * ticks, gaps and the playhead standing on one of them — sideways under the reader.
 *
 * There is nothing here for a keyboard, and nothing is claimed: the crop strip's two thumbs
 * are what a keyboard reaches there, and they move the crop — the playhead has never been
 * one of them, being an instant something was pointed at rather than a value anyone sets (see
 * ProjectSelection). So this offers a pointer affordance and no role, rather than a slider
 * role over something that would not answer a key.
 */
function ScrubTimeline({window, selection, gaps, onCommit}: TimelineProps) {
  const axisMax = axisEnd(window);
  const {onFrame, onceNow} = useFrameCommit(onCommit);

  // The press in flight, if any — just its pointer id, there being no threshold to cross
  // and no anchor to keep. It is what tells our own drag from somebody else's passing over
  // the strip with a button down, and a ref because the move handler reads it several times
  // a frame and nothing renders from it.
  const pressed = useRef<number | null>(null);

  const at = (event: React.PointerEvent<HTMLDivElement>) =>
    instantAt(event.currentTarget, event.clientX, window.start, axisMax);

  // A press puts the mark down at once, as it does inside the crop on the other strip, and
  // then carries it: there is no other thing a press here could become, so nothing waits on
  // a threshold.
  //
  // Pointer capture retargets every subsequent move and the release to the strip, so a drag
  // that wanders off it — off the page entirely — keeps tracking, and the release still
  // arrives at the handlers below. It also means those can be ordinary React props on this
  // element: no listeners to add, and so none that could outlive the gesture.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const ms = at(event);
    if (ms == null) return;
    event.preventDefault();
    // One at a time: a second finger landing on the strip would otherwise drag the mark
    // against the first.
    if (pressed.current != null) return;
    pressed.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    onceNow(playheadAt(selection, ms));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // Two pointers are answered and no others: a mouse merely hovering, and the press we
    // took. `buttons === 0` is the whole of how the first is told from a finger — a touch
    // pointer only ever moves while it is down, so a move with nothing held is a hover by
    // construction — and anything else held is a drag that began elsewhere, passing over.
    if (event.buttons !== 0 && pressed.current !== event.pointerId) return;
    const ms = at(event);
    // Only a strip with no width to measure, which is nowhere to point at.
    if (ms == null) return;
    onFrame(playheadAt(selection, ms));
  };

  // No pointerleave, deliberately, as on the crop strip: the mark is the instant the map is
  // reading and not the pixel a hand is on, so it stays on the last minute it was carried to
  // — which on the map view is the point of the strip. A pin has room for one number, and
  // parking the mark is how you choose which minute that number is for.
  //
  // Nothing to commit at the end of a scrub — every frame of it has already landed. All this
  // does is open the gate again, and it is wired to lost capture as well as to up and cancel,
  // that being the one signal a press cannot end without.
  const endPress = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pressed.current === event.pointerId) pressed.current = null;
  };

  return (
    // The grip width held back at each end, the way the crop strip's root holds it. There
    // are no grips here to leave room for; the axis stands in the same place in both views
    // because it is the same evening, and this is also the room the outermost tick labels
    // are cut in rather than pulled inside.
    <Box px={`${HANDLE_W}px`}>
      <Box
        position="relative"
        height={`${STRIP_H}px`}
        // The whole strip is pointable, end to end, and says so — the same crosshair the row
        // charts and the other strip carry.
        cursor="crosshair"
        // Two things zag puts on its own control, and this strip needs both for the same
        // reason it needs them: a horizontal drag here is a scrub, so the browser must not
        // read it as a pan and take the gesture away, and there is type on the strip (the
        // tick labels) that a drag would otherwise select rather than scrub past.
        touchAction="none"
        userSelect="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onLostPointerCapture={endPress}
      >
        {/* The frame, and the only thing drawn on the ground here: with no window picked
            there is no figure to set off, so the strip is the toolbar's own ground with the
            clock on it. Back out over the padding, so it is the whole width even though the
            axis inside it stops a grip's width short of either end. */}
        <Box
          position="absolute"
          top="0"
          bottom="0"
          left={`-${HANDLE_W}px`}
          right={`-${HANDLE_W}px`}
          rounded="md"
          borderWidth={`${FRAME_W}px`}
          borderColor="chart.rule"
        />

        {/* The clock the strip is read against, in the axis' own coordinates — this box is
            that axis, which is what lets every fraction inside be a plain percentage. Handed
            the same overhang the frame above reaches by. */}
        <TimelineMarkers
          start={window.start}
          end={axisMax}
          gaps={gaps}
          overhang={HANDLE_W}
        />

        {/* Last, so it draws over the grid — there are no thumbs here to pass over it. With
            its pill whenever there is a mark at all: nothing is ever drawn here without one,
            there being no window on this strip to draw and so no gesture that clears it. */}
        {selection.current != null && (
          <Playhead
            fraction={axisFraction(selection.current, window.start, axisMax)}
            label={labelFormat(selection.current)}
          />
        )}
      </Box>
    </Box>
  );
}
