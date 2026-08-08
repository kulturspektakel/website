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
const ariaValueText = ({value}: {value: number}) => formatInstant(value);

// A crop window rather than a line with knobs: the strip is the whole pickable
// span, the lit part between the two handles is the selection, and everything
// outside it is dimmed. Sized in px because zag needs a concrete thumb size to
// keep the handles inside the strip (thumbAlignment="contain").
const STRIP_H = 44;
const HANDLE_W = 12;

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
  // half-thumb inset included (thumbAlignment="contain" shrinks the usable span by
  // one thumb width), because the handler below bypasses it. Unsnapped because the
  // first thing it decides is which side of an edge the pointer is on, and on a
  // narrow window the grid would answer that wrong.
  const pointerAt = (control: HTMLElement, clientX: number): number | null => {
    const {left, width} = control.getBoundingClientRect();
    const span = width - HANDLE_W;
    if (span <= 0) return null;
    const ratio = clampTo((clientX - left - HANDLE_W / 2) / span, 0, 1);
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
          readable. It changes under a scrub or a hover, and holds still while doing
          it because the area sets tabular figures (see crew.lautstaerke). */}
      <Text fontWeight="bold" color={live ? 'green.400' : undefined} truncate>
        {live ? 'Live' : formatInstant(selection.current)}
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
        // Keeps the handles within the strip, so the one at 0 doesn't hang off
        // the left edge like a knob would.
        thumbAlignment="contain"
        thumbSize={{width: HANDLE_W, height: STRIP_H}}
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
          {/* Outside the selection: the span you could pick, dimmed. */}
          <ChakraSlider.Track h="full" rounded="md" bg="gray.950">
            {/* Inside it: the window. Range spans first→last thumb, which is
                start→end whether or not the playhead sits between them. The cursor
                names which of the two drags this is: a cropped window is grabbable,
                an uncropped one is clickable to place the playhead — and while live
                with nothing cropped, neither. */}
            <ChakraSlider.Range
              bg="gray.700"
              cursor={cropped ? 'grab' : live ? undefined : 'pointer'}
              _active={cropped ? {cursor: 'grabbing'} : undefined}
            />
          </ChakraSlider.Track>

          {thumbs.map((_, i) => {
            const playhead = !live && i === 1;
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
                width={`${HANDLE_W}px`}
                height={`${STRIP_H}px`}
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
                  // A line across the whole strip with a head on top, so it reads
                  // as a position in time rather than a draggable edge.
                  <Box w="2px" h="full" bg="gray.50" position="relative">
                    <Box
                      position="absolute"
                      top="-1px"
                      left="50%"
                      transform="translateX(-50%)"
                      w="2.5"
                      h="2.5"
                      rounded="sm"
                      bg="gray.50"
                    />
                  </Box>
                ) : (
                  // A trim bracket: the full height of the strip, so the window's
                  // edge is something you can obviously take hold of.
                  <Box
                    w="full"
                    h="full"
                    rounded="sm"
                    bg="gray.300"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Box w="2px" h="14px" rounded="full" bg="gray.600" />
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
