import {Box} from '@chakra-ui/react';
import {LevelTrace} from './LevelTrace';
import {
  useProjectView,
  type DeviceWindows,
  type NoiseLimit,
} from './projectView';

// A location's levels over the crop, as one chart of the place.
//
// This file used to be DeviceRow: a location was a row per monitor standing at it, each
// with its own name, its own numbers and its own trace. That said the same thing twice
// for the ordinary location, which has one monitor, and for the location that has had
// three over a weekend it drew three charts of one evening each — which is not what
// anybody standing at that stage experienced.
//
// So there is no device row any more, only this. The lines are the monitors the location
// has *ever* had, each clipped to the windows it had them for (see locationLines), which
// is what lets a handover read as one continuous trace and what keeps a monitor's time at
// another stage off this chart. Two monitors standing here at once are two lines with the
// louder of them filled underneath, which is the case the envelope exists for.
//
// Always drawn, including for a location nothing has stood at yet: an empty pair of axes
// says "nothing was measured here", and a card that simply omits the chart says nothing
// and jumps a hundred pixels the moment a monitor is assigned.
export function LocationChart({
  lines,
  limits,
}: {
  lines: DeviceWindows[];
  // What this place is permitted, whole — the same history-not-instant treatment the lines
  // get. A limit that ended at midnight is still part of a crop that covers midnight.
  limits: readonly NoiseLimit[];
}) {
  const {live, picked, range, bounds, traces, scrubTo, cropTo} =
    useProjectView();

  // Which of the chart's two modes this card is in, as the one object that decides it:
  // live is the rolling window and has nothing to point at, and a crop is a timeframe
  // with a playhead in it and gestures to move both (see LevelTrace, whose props are
  // this pair of shapes). Spread rather than branched into two elements, so the props
  // every mode shares are written once.
  const mode = live
    ? ({live: true} as const)
    : ({
        live: false,
        // The crop — the same one the traces were built for.
        range,
        // How far a finger may take that crop: the whole pickable project rather than the
        // part on screen, so a pinch has somewhere to widen into.
        bounds,
        // Hovering any trace moves the page's playhead, which is what puts the line in
        // the same place on every other card and on the timeline.
        onScrub: scrubTo,
        // `i`/`o` over the trace, a drag across it, or two fingers on it crop the page's
        // timeframe to what was pointed at.
        onCrop: cropTo,
        traces,
      } as const);

  return (
    // Unframed: the card is already a bordered box and the chart is nearly all of it,
    // so a second border round the trace was a line drawn a few pixels inside the
    // first. Its own axes are what bound it now. All this box does is take what the
    // card has left over — the cards divide the page between them, and the chart is the
    // part of one that can use the room.
    <Box flex="1" minH="0">
      <LevelTrace
        // Grouped by the card above, which names the same monitors in the same order —
        // the chart's lines and the header's names are one list, not two derivations of
        // it. The whole assignment history, not the monitors resolved at the playhead:
        // the chart spans the crop, so what stood here an hour ago is part of it even
        // while you are looking at now.
        lines={lines}
        // Every series the header has ticked, one line each per monitor. The card above
        // prints one number per line in the same shade, and the pin on the map reads the
        // first of them — one of these lines and not a tenth quantity, which is what keeps
        // the header, the chart and the map one statement.
        picked={picked}
        // What the place is allowed to be, as a dashed rule across the hours each limit
        // applies to, in the shade of the series it is written against — and only for the
        // series `picked` above, so a rule and the line it bounds come into view together
        // (see drawLimits).
        limits={limits}
        {...mode}
      />
    </Box>
  );
}
