import {Box, Slider as ChakraSlider} from '@chakra-ui/react';
import {useEffect, useRef, useState} from 'react';
import {formatInstant, snapToQuarter} from './timeframe';
import {
  commitProjectSelection,
  nudgeSelectionThumb,
  selectionThumbs,
  setSelectionCurrent,
  thumbsToSelection,
  type ProjectSelection,
} from './projectSelection';
import {instantLabel} from './chartUtils';
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
// step gets moved, and when the neighbour it is anchored on is the playhead, "where
// it gets moved to" changes every frame of a hover — which is a visible wobble on a
// thumb the user is not touching. With the step at one millisecond every instant is
// on the grid by construction, so that normalization can only ever be a no-op.
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
// outside it is dimmed.
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
//    off the side of it. zag centres a thumb with a translate of its own width, so
//    the box can be widened for a hit area without moving what's drawn in it — which
//    is all PLAYHEAD_HIT is.
const STRIP_H = 44;
const HANDLE_W = 12;
const PLAYHEAD_W = 1;
const PLAYHEAD_HIT = 11;

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

// Each thumb carries its own readout, hidden until it is being pointed at or moved:
// three pills standing open over a 44 px strip would cover the very thing they label,
// and while dragging one the other two are not what anyone is reading. Hoisted, so
// Emotion hashes it once rather than per frame of a scrub.
//
// Four ways to be "now": hovered, dragged by zag (which flags the thumb it is moving),
// stepped with the keyboard (focus-visible, so the value is readable while arrowing),
// and carried by a scrub off the strip itself, which zag knows nothing about — hence
// data-moving below.
const READOUT_ATTR = 'data-readout';
const READOUT_CSS = {
  [`& [${READOUT_ATTR}]`]: {display: 'none'},
  [`&:hover [${READOUT_ATTR}], &[data-dragging] [${READOUT_ATTR}], &[data-focus-visible] [${READOUT_ATTR}], &[data-moving] [${READOUT_ATTR}]`]:
    {display: 'block'},
} as const;

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

/**
 * Picks a sub-range of a noise project's window and a cursor inside it: three thumbs
 * on one track, start · cursor · end.
 *
 * Mounted only while scrubbing. Live mode reads what is arriving now, which is neither
 * a range nor an instant anyone picked, so the page leaves this out entirely rather
 * than showing a strip with nothing to point at — hence no `live` anywhere below, and
 * the `false` handed to the selection helpers, which still describe both layouts.
 *
 * The strip is the whole component: it is the page's second toolbar, and what a thumb
 * stands on is read off the thumb itself (see READOUT_CSS) rather than from a line of
 * text beside it. The two date fields that used to sit under it are gone — every
 * instant they set can be dragged, and a toolbar is not where a form belongs.
 *
 * `onCommit` fires as the drag moves rather than on release, so the page follows the
 * pointer; see useFrameCommit for the rate that happens at.
 */
export function ProjectTimeline({
  window,
  selection,
  gaps,
  onCommit,
}: {
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
}) {
  // A degenerate window — a project that hasn't started — would have zag dividing by
  // its own span, so give it one unit to work with. Nothing is pickable in it either
  // way.
  const sliderMax = Math.max(window.end, window.start + STEP_MS);

  // Every gesture commits as it moves, so `selection` is the only truth there is —
  // there is no in-flight copy to preview from. It used to be one: while the
  // timeframe lived in the URL, committing per pointer move meant a navigation and a
  // refetch per move, so the drag showed a local preview and committed on release.
  // The whole event is in the browser now, so the views can simply follow.
  const thumbs = selectionThumbs(selection, false);
  const {onFrame, onceNow} = useFrameCommit(onCommit);

  // What a thumb does when it runs into its neighbour, which differs by thumb — so
  // it is set as the drag starts rather than once for the slider.
  //
  // An edge pushes: zag's default stops a thumb dead at its neighbour, so the
  // playhead would block a window being narrowed past the instant you were looking
  // at. The playhead itself must not push, though — it marks a position inside the
  // window, so dragging it has to stop at the edges instead of dragging them along.
  //
  // Only pointer drags consult this; zag's keyboard stepping always stops at the
  // neighbour, so arrow keys on an edge still can't push the playhead past itself.
  const [collision, setCollision] = useState<'none' | 'push'>('none');

  // Whether a scrub off the strip itself is in flight, so the playhead can show its
  // readout while it travels — zag flags the thumb *it* is dragging, and it is not
  // involved in this one. State and not the ref below, because it is read while
  // rendering; set twice per gesture, not per move.
  const [scrubbing, setScrubbing] = useState(false);

  // Which pointer owns that scrub, if any. Nothing else needs remembering: a scrub is
  // absolute — it reads an instant off the pointer and writes it to `current` — so
  // there is no origin to measure against and no starting selection to hold on to.
  //
  // A ref because it gates the pointerdown handler synchronously, and nothing renders
  // from it.
  const scrubPointer = useRef<number | null>(null);

  // The instant a pointer sits over, unsnapped. Mirrors zag's own point→value math,
  // which the handler below bypasses: under thumbAlignment="center" that is the
  // control's own box end to end, with no inset of its own — the room the grips need
  // is padding on the root, and so already outside the box this measures. Unsnapped
  // because the first thing it decides is which side of an edge the pointer is on,
  // and on a narrow window the grid would answer that wrong.
  const pointerAt = (control: HTMLElement, clientX: number): number | null => {
    const {left, width} = control.getBoundingClientRect();
    if (width <= 0) return null;
    // The same normalization the markers and the readout use, asked in pixels: where
    // the pointer stands between the control's two edges.
    const ratio = axisFraction(clientX, left, left + width);
    return window.start + ratio * (sliderMax - window.start);
  };

  // The selection with its playhead moved to an instant the pointer named. Onto the
  // quarter hour first, because that is the grid a commit on release would snap it to
  // anyway (see commitProjectSelection) — a preview on any other would jump when let go.
  // setSelectionCurrent does the clamping, and is the page's one rule for where the
  // cursor may stand: the same call the row charts' hover goes through, so a window
  // narrower than a step puts the playhead somewhere valid here for the same reason it
  // does there.
  const withPlayheadAt = (ms: number) =>
    setSelectionCurrent(selection, snapToQuarter(ms));

  // zag gives a track press to whichever thumb is nearest, so a press just inside the
  // window drags that edge over to the pointer — losing a crop the user set
  // deliberately, and with it the range the page is showing. So presses that land inside
  // the window are taken over here, where they set the playhead. Outside it, zag's rule
  // is the right one — the nearer edge stretches out to meet the pointer — so those
  // fall through untouched.
  //
  // Capture phase, since zag's own handler sits on this element and would
  // otherwise run first.
  const onControlPointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    // A grip and the playhead each drag themselves; their pointerdown passes
    // through here on its way down, and stealing it would freeze them.
    if ((event.target as HTMLElement).closest('[role="slider"]')) return;

    const control = event.currentTarget;
    const at = pointerAt(control, event.clientX);
    if (at == null || at <= selection.start || at >= selection.end) return;

    event.preventDefault();
    event.stopPropagation();
    // One at a time: a second finger landing on the strip would otherwise start its own
    // and fight the first over the same playhead.
    if (scrubPointer.current != null) return;

    scrubPointer.current = event.pointerId;
    setScrubbing(true);
    // A press is already the whole gesture — the playhead goes where it landed, and a
    // drag from there is that same answer repeated as the pointer travels.
    onceNow(withPlayheadAt(at));
    // Pointer capture retargets every subsequent move and the release to the strip,
    // so a drag that wanders off it — off the page entirely — keeps tracking, and
    // the release still arrives at the handlers below. It also means those can be
    // ordinary React props on the same element: no listeners to add, and so none
    // that could outlive the gesture and go on following the pointer.
    control.setPointerCapture(event.pointerId);
  };

  // Only ever the pointer that started the scrub. zag drags its own thumbs off document
  // listeners, so its gestures pass through here with `scrubPointer` unset.
  const ownScrub = (event: React.PointerEvent) =>
    scrubPointer.current === event.pointerId;

  const onControlPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ownScrub(event)) return;
    // Nothing is holding the playhead any more: a release we never saw, because the
    // browser took the capture away mid-gesture. End where it stands rather than
    // following an empty pointer — and clear the gate, or no later drag can start.
    if (event.buttons === 0) return endScrub();
    const next = pointerAt(event.currentTarget, event.clientX);
    if (next == null) return;
    // Off the live selection rather than the one the press started from: a scrub only
    // ever writes `current`, so there is nothing of the earlier copy worth keeping.
    // Already on the quarter hour the release would snap to, so ending needs nothing
    // further.
    onFrame(withPlayheadAt(next));
  };

  // Nothing to commit here any more: every move already did. All that is left is
  // releasing the gate, so the next pointer can start a scrub.
  const endScrub = () => {
    scrubPointer.current = null;
    setScrubbing(false);
  };

  const onControlPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (ownScrub(event)) endScrub();
  };

  // Read the same way the row charts' tooltip reads it, off the same rule and the same
  // span — the crop, which is what those charts are showing. A hover writes both at
  // once, and one of them saying 22:15 while the other says 09.08. 22:15 would read as
  // two different instants.
  const labelFormat = instantLabel(false, selection.end - selection.start);

  return (
    <ChakraSlider.Root
      min={window.start}
      max={sliderMax}
      step={STEP_MS}
      value={thumbs}
      // Straight through as the thumbs move: a value zag hands over is already an
      // instant, so the thumb stays under the pointer and a thumb that didn't move
      // comes back untouched.
      onValueChange={(e) =>
        onFrame(thumbsToSelection(e.value, false, selection))
      }
      // The wall-clock snap lands once, on release. Doing it per move would pull
      // each value off the grid zag is computing from — the thumb would sit up to
      // half a step away from the pointer for the whole drag, on a project whose
      // window doesn't start on a quarter hour.
      onValueChangeEnd={(e) =>
        onceNow(
          commitProjectSelection(
            thumbsToSelection(e.value, false, selection),
            selection,
            window,
          ),
        )
      }
      getAriaValueText={ariaValueText}
      thumbCollisionBehavior={collision}
      // The grip width, held back at each end: it shrinks the control, and so the
      // axis, leaving the room a grip standing outside the range needs. The track
      // reaches back over it, so nothing about the strip moves — only the span its
      // ends can be dragged to.
      px={`${HANDLE_W}px`}
      // Every thumb sits at its plain value percentage, which is the coordinate the
      // range is laid out in too. See the note above the constants for what rests
      // on that.
      thumbAlignment="center"
      aria-label={['Beginn', 'Zeitpunkt', 'Ende']}
    >
      <ChakraSlider.Control
        height={`${STRIP_H}px`}
        onPointerDownCapture={onControlPointerDownCapture}
        onPointerMove={onControlPointerMove}
        onPointerUp={onControlPointerUp}
        onPointerCancel={onControlPointerUp}
        // Fires on the ordinary release and whenever the browser takes the capture
        // away, so it is the one signal a scrub can't end without.
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

            Hit-testable, and the one thing here that is: this is the lit part, and a press
            on it is a press on the window. The cursor says so at every crop width, because
            there is one thing such a press does — put the playhead where it landed. */}
        <Box
          position="absolute"
          top={`${FRAME_W}px`}
          bottom={`${FRAME_W}px`}
          {...CROP_SPAN}
          bg="accent.solid/15"
          cursor="pointer"
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

        {thumbs.map((value, i) => {
          const playhead = i === 1;
          const start = i === 0;
          return (
            <ChakraSlider.Thumb
              key={i}
              index={i}
              // Set while a scrub off the strip is carrying this thumb, which only the
              // playhead ever is — pressing the window is the one gesture here that
              // moves a thumb the pointer is not on. zag flags the thumb it is
              // dragging itself, but it has no part in that one.
              data-moving={(playhead && scrubbing) || undefined}
              css={READOUT_CSS}
              // Neutralize the default round knob; these are grips and a
              // playhead, drawn by the children below.
              bg="transparent"
              borderWidth="0"
              boxShadow="none"
              rounded="none"
              // The column the value occupies. The playhead is the only one drawn
              // inside its own box and so the only one that needs it widened, to
              // something a finger can find; a grip hangs off the side of its box
              // and brings its own hit area with it.
              width={`${playhead ? PLAYHEAD_HIT : PLAYHEAD_W}px`}
              height={`${STRIP_H}px`}
              // Above the playhead's hit area, which is wider than the line it
              // draws and overlaps a grip whenever it is parked against one. The
              // grip has to win that: the playhead can also be placed by pressing
              // the window, while a grip is the only way to move an edge.
              zIndex={playhead ? undefined : '3'}
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor={playhead ? 'grab' : 'ew-resize'}
              _active={playhead ? {cursor: 'grabbing'} : undefined}
              // Before zag reads it: a discrete event's state update is flushed
              // before the browser dispatches the first move of the drag, and the
              // behaviour is consulted per move rather than once at the start.
              // Composed with zag's own handler, not replacing it — Ark merges.
              onPointerDownCapture={() =>
                setCollision(playhead ? 'none' : 'push')
              }
              // Capture, for the same reason: zag's own key handler sits on this
              // element and bails on an event that has already been defaulted, so
              // preventing it here is what replaces its one-millisecond stride. Keys
              // it isn't given — Home, End — still reach it untouched.
              onKeyDownCapture={(event) => {
                const steps = KEY_STEPS[event.key];
                if (steps == null) return;
                event.preventDefault();
                onceNow(
                  nudgeSelectionThumb(
                    selection,
                    {index: i, steps, live: false},
                    window,
                  ),
                );
              }}
              // The mark itself takes the focus ring's colour — everything drawn in
              // this box except the readout, which is a pill of its own and would
              // otherwise turn blue along with the thing it labels.
              _focusVisible={{
                outline: 'none',
                [`& > *:not([${READOUT_ATTR}])`]: {bg: 'accent.focusRing'},
              }}
            >
              <ChakraSlider.HiddenInput />
              {/* The instant this thumb stands on, over the strip and absolutely
                  positioned on the thumb's own column, so it follows the value without
                  anything being measured.
                  Its left edge starts at the thumb and it is then pulled back by its
                  own width in proportion to how far along the strip that thumb is:
                  centred in the middle (-50 %), flush right of the first thumb at the
                  far left (0 %), flush left of the last at the far right (-100 %). That
                  one expression is the clamping — a pill narrower than the strip cannot
                  leave it at any position, and it never stops pointing at its thumb the
                  way a hard clamp would. Inline, because it changes per frame of a drag
                  and a style prop would have Emotion hash a class for each one. */}
              <Box
                {...{[READOUT_ATTR]: ''}}
                {...CHART_READOUT_STYLE}
                position="absolute"
                bottom="100%"
                mb="1"
                left="50%"
                pointerEvents="none"
                zIndex="4"
                style={{
                  transform: `translateX(-${axisFraction(value, window.start, sliderMax) * 100}%)`,
                }}
              >
                {labelFormat(value)}
              </Box>
              {playhead ? (
                // A hairline across the whole strip, so it reads as a position in
                // time rather than a draggable edge. The same width and the same
                // near-white as the one the row charts draw (see LevelTrace's
                // CHART_CSS): one instant, standing in several places at once, and
                // it should be recognisably the same mark in each of them. It is
                // the grips' yellow that tells it apart from an edge here.
                <Box w={`${PLAYHEAD_W}px`} h="full" bg="chart.playhead" />
              ) : (
                // A trim bracket, the full height of the strip, so the window's
                // edge is something you can obviously take hold of. Alongside its
                // thumb rather than around it: the range starts at the column the
                // thumb marks, so this ends where the range begins, and the two
                // meet without either covering the other. Rounded on the outer
                // side only, for the same reason — and to the strip's own radius,
                // so an uncropped window reads as one bar with its ends held.
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
              )}
            </ChakraSlider.Thumb>
          );
        })}
      </ChakraSlider.Control>
    </ChakraSlider.Root>
  );
}
