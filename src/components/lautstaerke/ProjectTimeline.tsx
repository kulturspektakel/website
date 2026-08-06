import {
  Box,
  HStack,
  Input,
  Slider as ChakraSlider,
  Text,
  VStack,
} from '@chakra-ui/react';
import {useEffect, useState} from 'react';
import {Field} from '../chakra-snippets/field';
import {
  MINUTE_MS,
  QUARTER_MINUTES,
  commitProjectSelection,
  formatInstant,
  fromLocalInput,
  selectionThumbs,
  setProjectBound,
  thumbsToSelection,
  toLocalInput,
  type ProjectSelection,
} from './timeframe';

// The slider's own unit is whole minutes from the project's start, and it steps a
// quarter hour at a time — so every thumb, cursor included, moves in 15-minute
// increments. An exact time is still reachable by typing it into the fields below,
// which is why commitProjectSelection only snaps what actually moved. Which thumb
// is which depends on the mode, so selectionThumbs/thumbsToSelection own that
// mapping.
// A crop window rather than a line with knobs: the strip is the whole pickable
// span, the lit part between the two handles is the selection, and everything
// outside it is dimmed. Sized in px because zag needs a concrete thumb size to
// keep the handles inside the strip (thumbAlignment="contain").
const STRIP_H = 44;
const HANDLE_W = 12;

/**
 * Picks a sub-range of a noise project's window, and — unless `live` — a cursor
 * inside it: thumbs are start · cursor · end on one track, or just start · end
 * while live, since live data has no instant to point at. `onCommit` fires on drag
 * release and on manual edits, not on every pointer move, so dragging stays cheap
 * and doesn't spam history.
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
  const toMinutes = (ms: number) => Math.round((ms - window.start) / MINUTE_MS);
  const toMs = (minutes: number) => window.start + minutes * MINUTE_MS;
  const totalMinutes = Math.max(toMinutes(window.end), 1);

  // The values under the pointer while a drag is in flight, so the fields and the
  // readout track it; null the rest of the time, when the committed selection is
  // the truth. Held as a selection rather than as thumb positions so it can't
  // disagree with `live` about how many thumbs there are.
  const [drag, setDrag] = useState<ProjectSelection | null>(null);
  // Dropped as soon as committed values land — or change from elsewhere: the back
  // button, a typed field. Only onValueChangeEnd commits, so the URL (and the data
  // load it triggers) still waits for release.
  useEffect(() => {
    setDrag(null);
  }, [selection.start, selection.current, selection.end]);

  const shown = drag ?? selection;
  const thumbs = selectionThumbs(shown, live).map(toMinutes);

  return (
    <VStack
      align="stretch"
      gap="3"
      p="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
    >
      {/* The cursor has no field of its own, so this is the only place its value
          is readable. Tabular figures keep it from twitching as it changes. */}
      <Text
        fontFamily="mono"
        fontWeight="bold"
        fontVariantNumeric="tabular-nums"
        color={live ? 'green.400' : undefined}
        truncate
      >
        {live ? 'Live' : formatInstant(shown.current)}
      </Text>

      <ChakraSlider.Root
        min={0}
        max={totalMinutes}
        step={QUARTER_MINUTES}
        value={thumbs}
        onValueChange={(e) =>
          setDrag(thumbsToSelection(e.value.map(toMs), live, shown))
        }
        onValueChangeEnd={(e) =>
          onCommit(
            commitProjectSelection(
              thumbsToSelection(e.value.map(toMs), live, selection),
              selection,
              window,
            ),
          )
        }
        // Keeps the handles within the strip, so the one at 0 doesn't hang off
        // the left edge like a knob would.
        thumbAlignment="contain"
        thumbSize={{width: HANDLE_W, height: STRIP_H}}
        aria-label={live ? ['Beginn', 'Ende'] : ['Beginn', 'Zeitpunkt', 'Ende']}
      >
        <ChakraSlider.Control height={`${STRIP_H}px`}>
          {/* Outside the selection: the span you could pick, dimmed. */}
          <ChakraSlider.Track h="full" rounded="md" bg="gray.950">
            {/* Inside it: the window. Range spans first→last thumb, which is
                start→end whether or not the playhead sits between them. */}
            <ChakraSlider.Range bg="gray.700" />
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
          value={shown.start}
          window={window}
          onCommit={(ms) =>
            onCommit(setProjectBound('start', ms, selection, window))
          }
        />
        <BoundField
          label="Ende"
          value={shown.end}
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
        fontFamily="mono"
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
