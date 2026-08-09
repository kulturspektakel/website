import {
  Box,
  HStack,
  Input,
  Slider as ChakraSlider,
  Text,
  VStack,
} from '@chakra-ui/react';
import {useEffect, useRef, useState} from 'react';
import {Field} from '../chakra-snippets/field';
import {
  clampTo,
  formatInstant,
  fromLocalInput,
  snapToQuarter,
  toLocalInput,
} from './timeframe';
import {
  commitProjectSelection,
  isCropped,
  nudgeSelectionThumb,
  panProjectSelection,
  selectionThumbs,
  setProjectBound,
  thumbsToSelection,
  type ProjectSelection,
} from './projectSelection';
import {instantLabel} from './chartUtils';

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
//  · Alignment is "center", so a thumb's offset is the plain value percentage — the
//    same coordinate Slider.Range is laid out in, which is what lets the two abut
//    exactly. ("contain" insets the thumbs but not the range, so under it the two
//    disagree by up to half a thumb.)
//  · Each thumb's box is the one-pixel column its value occupies, and a grip hangs
//    off the side of it. zag centres a thumb with a translate of its own width, so
//    the box can be widened for a hit area without moving what's drawn in it — which
//    is all PLAYHEAD_HIT is.
const STRIP_H = 44;
const HANDLE_W = 12;
const PLAYHEAD_W = 1;
const PLAYHEAD_HIT = 11;

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
 * Picks a sub-range of a noise project's window, and — unless `live` — a cursor
 * inside it: thumbs are start · cursor · end on one track, or just start · end
 * while live, since live data has no instant to point at.
 *
 * `onCommit` fires as the drag moves rather than on release, so the page follows the
 * pointer; see useFrameCommit for the rate that happens at.
 */
export function ProjectTimeline({
  window,
  cappedToNow = false,
  live,
  selection,
  onCommit,
}: {
  // The pickable window, which is not the project's own: it stops at the current
  // time while the event is still running (see visibleProjectWindow).
  window: {start: number; end: number};
  cappedToNow?: boolean;
  // Live mode reads the current measurements rather than a chosen instant, so the
  // cursor thumb has nothing to point at and is dropped.
  live: boolean;
  selection: ProjectSelection;
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
  const thumbs = selectionThumbs(selection, live);
  const {onFrame, onceNow} = useFrameCommit(onCommit);

  // Dragging the lit part means one of two things, and which one depends on whether
  // there is a crop to slide: with the whole strip selected there is no window to
  // move, so a drag inside it places the playhead; once it has been cropped, the
  // window itself is what the pointer takes hold of. Either way the edges and the
  // playhead keep their own thumbs, so nothing here is the only way to do anything.
  const cropped = isCropped(selection, window);

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

  // The gesture in flight, if any: which pointer owns it, which of the two it is,
  // and — since a pan is relative — where on the strip it was grabbed together with
  // the selection it was grabbed from. Both halves of that pair matter now that a pan
  // commits on every move: measuring the shift against the *live* selection would
  // apply it again to a selection that has already been shifted, and the window would
  // run away from the pointer.
  //
  // A ref because it gates the pointerdown handler synchronously, and nothing renders
  // from it.
  const gesture = useRef<{
    pointerId: number;
    mode: 'pan' | 'scrub';
    grabbedAt: number;
    from: ProjectSelection;
  } | null>(null);

  // The instant a pointer sits over, unsnapped. Mirrors zag's own point→value math,
  // which the handler below bypasses: under thumbAlignment="center" that is the
  // control's own box end to end, with no inset of its own — the room the grips need
  // is padding on the root, and so already outside the box this measures. Unsnapped
  // because the first thing it decides is which side of an edge the pointer is on,
  // and on a narrow window the grid would answer that wrong.
  const pointerAt = (control: HTMLElement, clientX: number): number | null => {
    const {left, width} = control.getBoundingClientRect();
    if (width <= 0) return null;
    const ratio = clampTo((clientX - left) / width, 0, 1);
    return window.start + ratio * (sliderMax - window.start);
  };

  // Onto the quarter hour, then back inside the window — so a window narrower than a
  // step still puts the playhead somewhere valid rather than outside its own range.
  // snapToQuarter, because that is what the commit on release will do (see
  // commitProjectSelection): a preview on any other grid would jump when let go.
  const playheadAt = (ms: number) =>
    clampTo(snapToQuarter(ms), selection.start, selection.end);

  // zag gives a track click to whichever thumb is nearest, so a click just inside
  // the window drags that edge over to the pointer — losing a crop the user set
  // deliberately, and with it the range the page is showing. So drags that land
  // inside the window are taken over here: they pan the window, or move the
  // playhead when there is no crop to pan. Outside it, zag's rule is the right one —
  // the nearer edge stretches out to meet the pointer — so those clicks fall
  // through untouched.
  //
  // Capture phase, since zag's own handler sits on this element and would
  // otherwise run first.
  const onControlPointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    // A grip and the playhead each drag themselves; their pointerdown passes
    // through here on its way down, and stealing it would freeze them. This is also
    // what keeps the playhead grabbable while the window around it pans.
    if ((event.target as HTMLElement).closest('[role="slider"]')) return;

    const control = event.currentTarget;
    const at = pointerAt(control, event.clientX);
    if (at == null || at <= selection.start || at >= selection.end) return;

    event.preventDefault();
    event.stopPropagation();
    // Nothing to pan and, while live, no playhead to place either — swallowing the
    // click is the point: the edges stay where they are.
    if (!cropped && live) return;

    // One gesture at a time: a second finger landing on the strip would otherwise
    // start its own and fight the first over the same selection.
    if (gesture.current != null) return;

    const mode = cropped ? 'pan' : 'scrub';
    gesture.current = {
      pointerId: event.pointerId,
      mode,
      grabbedAt: at,
      from: selection,
    };
    // A pan is relative, so it does nothing until the pointer actually travels — and
    // so a stray click on the window writes no selection at all. A scrub jumps the
    // playhead to where it was clicked.
    if (mode === 'scrub') onceNow({...selection, current: playheadAt(at)});
    // Pointer capture retargets every subsequent move and the release to the strip,
    // so a drag that wanders off it — off the page entirely — keeps tracking, and
    // the release still arrives at the handlers below. It also means those can be
    // ordinary React props on the same element: no listeners to add, and so none
    // that could outlive the gesture and go on following the pointer.
    control.setPointerCapture(event.pointerId);
  };

  // Only ever the pointer that started the gesture. zag drags its own thumbs off
  // document listeners, so its gestures pass through here with `gesture` unset.
  const ownGesture = (event: React.PointerEvent) =>
    gesture.current?.pointerId === event.pointerId ? gesture.current : null;

  const onControlPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = ownGesture(event);
    if (!active) return;
    // Nothing is holding the selection any more: a release we never saw, because the
    // browser took the capture away mid-gesture. End where it stands rather than
    // following an empty pointer — and clear the gate, or no later drag can start.
    if (event.buttons === 0) return endGesture();
    const next = pointerAt(event.currentTarget, event.clientX);
    if (next == null) return;
    onFrame(
      active.mode === 'pan'
        ? // Against the selection the pan started from, so the shift is absolute
          // rather than compounding. panProjectSelection snaps the shift itself,
          // which is what keeps the window's length exact — putting it through
          // commitProjectSelection would round each end on its own and stretch it.
          panProjectSelection(active.from, next - active.grabbedAt, window)
        : // playheadAt already lands on the quarter hour the release would snap to,
          // so a scrub needs nothing further when it ends.
          {...active.from, current: playheadAt(next)},
    );
  };

  // Nothing to commit here any more: every move already did. All that is left is
  // releasing the gate, so the next pointer can start a gesture.
  const endGesture = () => {
    gesture.current = null;
  };

  const onControlPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (ownGesture(event)) endGesture();
  };

  // The readout stands over the playhead rather than off in the corner, so the instant
  // is read where it is being pointed at. Two things have to hold at once: it is
  // centred on the line, and it never leaves the strip — so approaching either end it
  // stops travelling and the playhead carries on without it.
  //
  // One clamp does both, and does it in CSS: the bounds are percentages of the row,
  // which is the strip's own width, so nothing about the container has to be measured
  // for a resize to be followed. The label's own width is the one thing no percentage
  // can express, and so the one thing that is measured.
  const labelRef = useRef<HTMLParagraphElement>(null);
  const [labelW, setLabelW] = useState(0);
  useEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    // Delivered once on observe and again on every later change of width — 'Live' and
    // a timestamp are nothing like the same size — so the clamp is re-derived rather
    // than pinned to whichever of the two was on screen first. Rounded up, so the
    // sub-pixel drift a text measurement comes with can't churn state per frame.
    const ro = new ResizeObserver(() =>
      setLabelW(Math.ceil(el.getBoundingClientRect().width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // How far along the axis the playhead stands, 0…1. The axis is inset by a grip width
  // at each end (see the note above the constants), which is why the offset below is
  // not simply that fraction of the row. Pinned left while live: there is no playhead
  // to stand over then, and 'Live' belongs where it has always been.
  const labelAt = live
    ? 0
    : clampTo(
        (selection.current - window.start) / (sliderMax - window.start),
        0,
        1,
      );
  const labelLeft = `clamp(0px, ${HANDLE_W}px + ${labelAt} * (100% - ${
    HANDLE_W * 2
  }px) - ${labelW / 2}px, 100% - ${labelW}px)`;

  // Read the same way the row charts' tooltip reads it, off the same rule and the same
  // span — the crop, which is what those charts are showing. A hover writes both at
  // once, and one of them saying 22:15 while the other says 09.08. 22:15 would read as
  // two different instants.
  const labelFormat = instantLabel(live, selection.end - selection.start);

  return (
    <VStack
      align="stretch"
      gap="3"
      p="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
    >
      {/* The cursor has no field of its own, so this is the only place its value is
          readable. Tabular figures (see crew.lautstaerke) earn their keep twice here:
          the digits hold still as they change, and the label holds one width — so the
          measurement behind the clamp survives a whole scrub. */}
      <Text
        ref={labelRef}
        fontWeight="bold"
        color={live ? 'green.400' : undefined}
        // Shrink-wrapped rather than stretched to the row, so its width is the text's
        // and there is something for the offset to be centred on. Offset by `left`
        // while staying in flow, so it still reserves its own line and the strip
        // below doesn't climb into it.
        alignSelf="flex-start"
        maxW="full"
        truncate
        position="relative"
        // The one thing here that isn't a style prop, and the offset is why: a scrub
        // gives it a new value every frame, and Chakra serializes a style prop into a
        // hashed class and inserts a rule for it. That would be a rule per frame,
        // cached and never freed. An inline style is a single attribute write.
        style={{left: labelLeft}}
      >
        {live ? 'Live' : labelFormat(selection.current)}
      </Text>

      <ChakraSlider.Root
        min={window.start}
        max={sliderMax}
        step={STEP_MS}
        value={thumbs}
        // Straight through as the thumbs move: a value zag hands over is already an
        // instant, so the thumb stays under the pointer and a thumb that didn't move
        // comes back untouched.
        onValueChange={(e) =>
          onFrame(thumbsToSelection(e.value, live, selection))
        }
        // The wall-clock snap lands once, on release. Doing it per move would pull
        // each value off the grid zag is computing from — the thumb would sit up to
        // half a step away from the pointer for the whole drag, on a project whose
        // window doesn't start on a quarter hour.
        onValueChangeEnd={(e) =>
          onceNow(
            commitProjectSelection(
              thumbsToSelection(e.value, live, selection),
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
        aria-label={live ? ['Beginn', 'Ende'] : ['Beginn', 'Zeitpunkt', 'Ende']}
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
          {/* Outside the selection: the span you could pick, dimmed. Back out over
              the root's padding, so the strip is the whole window even though the
              axis inside it stops a grip short of either end. */}
          <ChakraSlider.Track
            h="full"
            rounded="md"
            bg="gray.950"
            mx={`-${HANDLE_W}px`}
          >
            {/* Inside it: the window. Range spans first→last thumb, which is
                start→end whether or not the playhead sits between them. Half a pixel
                wider at each end than those two thumbs, because a thumb marks a
                column and the range has to cover the whole of the two it ends on —
                otherwise the playhead standing on one would half hang out of the lit
                part, and the grip that abuts it would clip that half. The cursor
                names which of the two drags this is: a cropped window is grabbable,
                an uncropped one is clickable to place the playhead — and while live
                with nothing cropped, neither. */}
            <ChakraSlider.Range
              bg="gray.700"
              mx="-0.5px"
              cursor={cropped ? 'grab' : live ? undefined : 'pointer'}
              _active={cropped ? {cursor: 'grabbing'} : undefined}
            />
          </ChakraSlider.Track>

          {thumbs.map((_, i) => {
            const playhead = !live && i === 1;
            const start = i === 0;
            return (
              <ChakraSlider.Thumb
                key={i}
                index={i}
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
                // grip has to win that: the playhead can also be placed by clicking
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
                      {index: i, steps, live},
                      window,
                    ),
                  );
                }}
                _focusVisible={{outline: 'none', '& > *': {bg: 'blue.400'}}}
              >
                <ChakraSlider.HiddenInput />
                {playhead ? (
                  // A hairline across the whole strip, so it reads as a position in
                  // time rather than a draggable edge. The same width and the same
                  // near-white as the one the row charts draw (see LevelTrace's
                  // CHART_CSS): one instant, standing in several places at once, and
                  // it should be recognisably the same mark in each of them. It is
                  // the grips' yellow that tells it apart from an edge here.
                  <Box w={`${PLAYHEAD_W}px`} h="full" bg="gray.50" />
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
                    bg="yellow.400"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {/* Its own hue rather than a neutral, so the notch stays legible
                        on the yellow at the same contrast the grey pair had. */}
                    <Box w="2px" h="14px" rounded="full" bg="yellow.800" />
                  </Box>
                )}
              </ChakraSlider.Thumb>
            );
          })}
        </ChakraSlider.Control>
      </ChakraSlider.Root>

      <HStack gap="3" align="flex-start">
        <BoundField
          label="Beginn"
          value={selection.start}
          window={window}
          onCommit={(ms) =>
            onCommit(setProjectBound('start', ms, selection, window))
          }
        />
        <BoundField
          label="Ende"
          value={selection.end}
          window={window}
          onCommit={(ms) =>
            onCommit(setProjectBound('end', ms, selection, window))
          }
        />
      </HStack>

      {cappedToNow && (
        <Text fontSize="xs" color="gray.500">
          Das Projekt läuft noch, daher endet die Auswahl bei jetzt.
        </Text>
      )}
    </VStack>
  );
}

// One end of the range, typed rather than dragged. It keeps its own draft string
// because a datetime-local reports '' for a half-filled value: a field driven
// straight off the committed selection would snap back to the old time between
// keystrokes. Only a complete value commits, and blurring discards anything that
// didn't parse.
function BoundField({
  label,
  value,
  window,
  onCommit,
}: {
  label: string;
  value: number;
  window: {start: number; end: number};
  onCommit: (ms: number) => void;
}) {
  const [draft, setDraft] = useState(() => toLocalInput(value));
  useEffect(() => setDraft(toLocalInput(value)), [value]);

  return (
    <Field label={label}>
      <Input
        type="datetime-local"
        size="sm"
        // Native bounds, so the picker itself won't offer times outside the
        // project; setProjectBound clamps anyway for typed input.
        min={toLocalInput(window.start)}
        max={toLocalInput(window.end)}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = fromLocalInput(e.target.value);
          if (parsed) onCommit(parsed.getTime());
        }}
        // Never leave a value on screen that isn't the one in effect: if the draft
        // parsed it was committed and `value` already matches, and if it didn't
        // this puts the real time back.
        onBlur={() => setDraft(toLocalInput(value))}
      />
    </Field>
  );
}
