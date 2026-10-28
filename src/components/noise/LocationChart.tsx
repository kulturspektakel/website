import {memo, useMemo, useState} from 'react';
import {Box} from '@chakra-ui/react';
import {LevelTrace} from './LevelTrace';
import {
  useProjectView,
  type DeviceWindows,
  type NoiseLocationItem,
} from './projectView';
import {locationTags, type NoiseRangeTag} from './rangeTags';
import {RangeTagDialog} from './RangeTagDialog';
import {RemoveTagDialog} from './RemoveTagDialog';
import {CommentDialog} from './CommentDialog';
import {isRangeKey} from './level';
import {exceedsLimit} from './limitLines';
import {rangeLeqs} from './projectLogs';

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
// Memoized, and its props are stable (the card's `lines` memo and a state setter): a sweep
// re-renders the card for its tile on every minute it crosses, and the trace below must not
// re-render with it.
export const LocationChart = memo(function LocationChart({
  location,
  lines,
  onSweep,
}: {
  // The place itself: its limits are drawn over the trace, and it is what a range swept
  // here is tagged against by default (see RangeTagDialog).
  location: NoiseLocationItem;
  lines: DeviceWindows[];
  // The range being swept across this chart — while it is dragged and while its menu is
  // open — or null, which the card's tile reads the Leq of (see LocationCard).
  onSweep: (range: {start: number; end: number} | null) => void;
}) {
  const {
    project,
    live,
    picked,
    range,
    bounds,
    traces,
    rangeIndex,
    scrubTo,
    cropTo,
  } = useProjectView();
  // Every tag that reaches this place — the event's, its own, and its monitors' while they
  // stood here (see locationTags) — once, for both lists below.
  const reaching = useMemo(
    () => locationTags(project.tags, location.id, lines),
    [project.tags, location.id, lines],
  );

  // What crew noted here.
  const comments = useMemo(
    () => reaching.filter((t) => t.type === 'COMMENT'),
    [reaching],
  );

  // The range the selection menu's "Ignore…" was chosen for, while its dialog is open.
  const [tagging, setTagging] = useState<{
    range: {start: number; end: number};
    type: 'IGNORE' | 'COMMENT';
  } | null>(null);
  // The ignored range whose pill ✕ was pressed, while its dialog is open.
  const [untagging, setUntagging] = useState<NoiseRangeTag | null>(null);
  // The comment whose label was pressed, while its dialog is open.
  const [editing, setEditing] = useState<NoiseRangeTag | null>(null);

  // Every ignored stretch that reaches this place. Memoized so the chart's redraw effect
  // only fires when a tag actually changes.
  const tags = useMemo(
    () => reaching.filter((t) => t.type === 'IGNORE'),
    [reaching],
  );

  // The hours of this place's `Leq,T` limits that were broken — what they came to, in the
  // weightings being read, was over the limit — by the same reading the card's tile turns red
  // on (see rangeLeqs), so the chart and the tile cannot disagree.
  const overRanges = useMemo(
    () =>
      location.limits.flatMap((limit) =>
        isRangeKey(limit.series) &&
        rangeLeqs(rangeIndex, location.id, limit, limit).some((leq) =>
          exceedsLimit(leq.db, leq.limit),
        )
          ? [{start: limit.start, end: limit.end}]
          : [],
      ),
    [location.limits, location.id, rangeIndex],
  );

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
        // A swept range tagged from the selection menu instead of zoomed into.
        onTag: (
          range: {start: number; end: number},
          type: 'IGNORE' | 'COMMENT',
        ) => setTagging({range, type}),
        traces,
        onSweepChange: onSweep,
        overRanges,
      } as const);

  return (
    // Unframed: the card is already a bordered box and the chart is nearly all of it,
    // so a second border round the trace was a line drawn a few pixels inside the
    // first. Its own axes are what bound it now. All this box does is take what the
    // card has left over — the cards divide the page between them, and the chart is the
    // part of one that can use the room.
    <Box flex="1" minH="0">
      <LevelTrace
        // A tooltip only while live. Scrubbing history, the card's header prints the
        // playhead's readings, including the `Leq,T` of the range it is in (see
        // LocationReadings), and a second readout beside the pointer would say it twice.
        // Live, the header stays on now whatever the pointer is over — so what the trace
        // read at the pointer is the tooltip's to say.
        tooltip={live}
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
        // (see drawLimits). The whole permit, not the limits in force at the playhead: a
        // limit that ended at midnight is still part of a crop that covers midnight.
        limits={location.limits}
        tags={tags}
        comments={comments}
        onOpenComment={(comment) =>
          setEditing(comments.find((t) => t.id === comment.id) ?? null)
        }
        // The chart hands back one of `tags`, so it is one of the records above.
        onUntag={(tag) =>
          setUntagging(tags.find((t) => t.id === tag.id) ?? null)
        }
        {...mode}
      />
      {tagging && (
        <RangeTagDialog
          type={tagging.type}
          range={tagging.range}
          location={location}
          lines={lines}
          onClose={() => setTagging(null)}
        />
      )}
      {editing && (
        <CommentDialog comment={editing} onClose={() => setEditing(null)} />
      )}
      {untagging && (
        <RemoveTagDialog
          tag={untagging}
          location={location}
          onClose={() => setUntagging(null)}
        />
      )}
    </Box>
  );
});
