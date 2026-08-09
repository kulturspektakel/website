import {Box} from '@chakra-ui/react';
import {LevelTrace} from './LevelTrace';
import {useProjectView, type DeviceWindows} from './projectView';

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
export function LocationChart({lines}: {lines: DeviceWindows[]}) {
  const {live, metric, weighting, range, bounds, traces, scrubTo, cropTo} =
    useProjectView();

  return (
    // Unframed: the card is already a bordered box and the chart is nearly all of it,
    // so a second border round the trace was a line drawn a few pixels inside the
    // first. Its own axes are what bound it now. All this box does is take what the
    // card has left over — the cards divide the page between them, and the chart is the
    // part of one that can use the room.
    <Box flex="1" minH="0">
      <LevelTrace
        // Grouped by the card above, which names the same monitors in the same order —
        // the chart's lines and the header's names are one list, not two derivations
        // of it. The whole assignment history, not the monitors resolved at the
        // playhead: the chart spans the crop, so what stood here an hour ago is part
        // of it even while you are looking at now.
        lines={lines}
        live={live}
        // The header's window — the same one the traces were built for, and the same
        // one the coloured number above is read in.
        metric={metric}
        weighting={weighting}
        range={range}
        // How far a finger may take the crop, and — being present at all — what installs
        // the touch gestures: one finger reads the trace, two crop and slide it. The whole
        // pickable project rather than the crop, so a pinch has somewhere to widen into.
        // Withheld while live for the same reason as the two callbacks below, and the same
        // reason there is no timeline to drag then.
        bounds={live ? undefined : bounds}
        // Hovering any trace moves the page's playhead, which is what puts the line in
        // the same place on every other card and on the timeline. Withheld while live
        // for the same reason there is no line then: there is nothing for it to move.
        onScrub={live ? undefined : scrubTo}
        // `i`/`o` over the trace, or a drag across it, crop the page's timeframe to
        // what was pointed at. Withheld while live for the same reason as the
        // playhead: the window follows the clock then, and a crop inside it would be
        // overwritten a second later.
        onCrop={live ? undefined : cropTo}
        series={traces}
      />
    </Box>
  );
}
