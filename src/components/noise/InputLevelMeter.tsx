import {Box, HStack, Text} from '@chakra-ui/react';
import {useTick} from './context';
import {formatDb} from './level';

// What the picked microphone is hearing, as one A-weighted figure and a bar the length of it.
//
// Here because everything else in the Input section is a choice with no feedback: a device is
// named, a calibration file is paired, and nothing on screen says whether any sound is arriving
// or how much. That gap is worst exactly where it matters — a run is thirty seconds long, and an
// input at the wrong level produces a full set of plausible numbers.

// The band the bar spans. A bar is read for where the level sits within a range, so the range
// has to be a constant: fitted to what has arrived it would put every level, loud or quiet,
// somewhere in the middle. Wide enough for a quiet room at one end and a PA at the other, and
// the figure beside it is what carries the precision — and what still says something when the
// level leaves the band and the bar is simply full or empty.
const FLOOR_DB = 30;
const CEILING_DB = 110;

// How often the bar is redrawn. Matched to how often there is a new figure to draw — the frame
// loop recomputes the level every METER_FRAMES frames, which is about this (see
// useReferenceMic) — so the bar moves as fast as the level does and no faster. Its own rate
// rather than the section's 1 Hz clock, which is what the page's charts run on.
const METER_MS = 135;

export function InputLevelMeter({inputLaeq}: {inputLaeq: () => number | null}) {
  // Subscribing to a clock at the rate the value changes; the tick's own value is unused. Only
  // this component re-renders on it — which is why the level lives in a ref the frame loop
  // writes rather than in state (see inputLaeq).
  useTick(METER_MS);
  const db = inputLaeq();
  const fraction =
    db == null
      ? 0
      : Math.max(0, Math.min(1, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));

  return (
    // Blue, set once here and read as `colorPalette` by the figure and the bar below. A palette
    // rather than a written-out `blue.600`: this panel's appearance has moved before, and a
    // palette resolves against whichever half is in force — see Chip, which colours the same
    // way. Not the microphone's chart colour, which the level here otherwise shares: this is a
    // control-panel readout rather than a line on a plot, and nothing is drawn beside it for a
    // matching colour to tie it to.
    <Box w="full" colorPalette="blue">
      <HStack justify="space-between" gap="2">
        <Text fontSize="xs" color="fg.subtle">
          Input level
        </Text>
        <Text fontSize="xs" fontWeight="bold" color="colorPalette.solid">
          {/* dB(A), because the figure is A-weighted and a bare "dB" beside an unweighted
              spectrum on the same screen would be two different quantities under one unit. The
              time weighting is left unsaid: it is a meter, and fast is what a meter is. */}
          {formatDb(db, 'dB(A)')}
        </Text>
      </HStack>
      <Box w="full" h="1.5" rounded="full" bg="bg.muted" overflow="hidden">
        <Box
          h="full"
          rounded="full"
          bg="colorPalette.solid"
          // Just long enough to bridge one update, so the bar reads as a level moving rather
          // than as a series of separate measurements. Longer than METER_MS and it would
          // always be catching up to a figure that has already changed.
          transition={`width ${METER_MS}ms linear`}
          style={{width: `${fraction * 100}%`}}
        />
      </Box>
    </Box>
  );
}
