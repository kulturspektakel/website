import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {noiseProjectLogs} from '../../routes/crew.noise';
import {
  locationEnergyIndex,
  logSeries,
  seriesLevelsByDevice,
  totalsByLocation,
  type LocationAssignments,
  type PlayheadLevels,
  type RangeTotals,
  type SeriesTraces,
} from './projectLogs';
import {coverageGaps, type LogGap} from './logCoverage';
import {noiseQueryKeys} from './queries';
import {logMinuteIndex} from './noise';
import {primaryWeighting, type PickedSeries} from './level';
import type {ProjectSelection} from './projectSelection';

// Whichever project this is, the whole thing at once. Immutable enough to pin: a
// past event never changes, and a running one only grows at its right edge, which
// live mode is watching over MQTT anyway. Pinning matters because the global client
// sets only refetchOnMount — with react-query's defaults, focusing the window or
// coming back from five minutes of live mode would re-scan the whole event.
const LOGS_CACHE = {
  staleTime: Infinity,
  gcTime: 60 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

/**
 * The project page's stored numbers: one request for the whole event, then every
 * question answered locally.
 *
 * Nothing is fetched while live mode is on — `enabled` is doing exactly what it is
 * for, and it also means SSR never touches this. The derived shapes are memoized apart
 * because they change on very different things: the levels follow the playhead's *minute*
 * alone; the running totals the payload, the primary's weighting and the assignments; the
 * crop's Leq those totals and the crop; the traces only the payload and the pick; the
 * coverage gaps the payload alone. So dragging the timeline leaves the levels, the traces
 * and the gaps alone, and scrubbing recomputes one small record — and only when it crosses
 * into a new minute.
 */
export function useProjectLogs({
  projectId,
  live,
  picked,
  selection,
  locations,
}: {
  projectId: string;
  live: boolean;
  // Every series the charts draw. The playhead's record carries all nine whatever is
  // picked (see seriesLevelsByDevice), so changing what the header prints recomputes
  // nothing there — only the traces follow the pick, and the crop's Leq follows the
  // primary's weighting.
  picked: PickedSeries;
  selection: ProjectSelection;
  // Which placements count as each location's, for the crop Leq below. The pins and
  // the charts resolve their own; this is the one number that has to be summed over
  // the whole crop rather than read at an instant.
  locations: readonly LocationAssignments[];
}): {
  levels?: PlayheadLevels;
  locationTotals?: Record<string, RangeTotals>;
  traces?: SeriesTraces;
  // The stretches of the event nobody reported in, which the timeline shades. Absent
  // while live and while the payload is in flight, so the strip draws nothing rather
  // than claiming the whole festival is missing.
  gaps?: LogGap[];
  isFetching: boolean;
} {
  const {data, isFetching} = useQuery({
    queryKey: noiseQueryKeys.projectLogs(projectId),
    queryFn: () => noiseProjectLogs({data: {projectId}}),
    enabled: !live,
    ...LOGS_CACHE,
  });

  // Nothing stored is answered while live, and `enabled` alone does not say that: a query
  // switched off keeps whatever it last fetched, and the payload is pinned for an hour on
  // purpose (see LOGS_CACHE), so going live after a scrub left every derived shape below
  // still standing on it. That mattered for the crop's Leq, which a card printed beside
  // its live readings — a number averaged over a timeframe the page is no longer looking
  // at. Dropped here rather than at each of the three memos, and rather than in the leaves:
  // "absent while live" is one rule about this hook's whole answer, and it is what the
  // context's fields (see ProjectViewCtx) already promise.
  const logs = live ? undefined : data;

  const {start, end, current} = selection;

  // Which weighting the crop's Leq comes out in: the primary pick's. An energetic mean is
  // one number over one column, so it has room for exactly one — and the primary is what
  // every other single-number readout on the page follows (see primarySeries). The card
  // labels it accordingly, LAeq,Range or LCeq,Range.
  const weighting = primaryWeighting(picked);

  // The playhead's readings, so keyed on the playhead and not on the crop — and on the
  // minute it stands in rather than the instant, because that is all the payload has.
  // A hover reports a new instant every animation frame, and on any crop shorter than a
  // day most of those frames land in the minute the last one did: keyed on the instant
  // this handed every row and every pin a new record, with the same numbers in it, sixty
  // times a second.
  //
  // Not keyed on the pick either, and it never was on the weighting's half of one: every
  // series is in the record, so ticking a box leaves this untouched.
  //
  // Null whenever nothing is pointing at the event, and then there are no readings to
  // give: the playhead is where a pointer is (see ProjectSelection), so a page nobody is
  // hovering has a crop and its traces but no instant, and every card and pin prints what
  // it prints without one. Withheld here rather than blanked in each of them, for the same
  // reason `logs` is dropped while live — "absent" is one rule about this hook's answer.
  const minute = logs && current != null ? logMinuteIndex(logs, current) : null;
  const levels = useMemo(
    () =>
      logs && minute != null ? seriesLevelsByDevice(logs, {minute}) : undefined,
    [logs, minute],
  );

  // The running totals every crop's Leq is read off, which depend on neither end of
  // it: dragging the timeline is the gesture that asks for those Leqs, once a frame
  // for every location, and this is what keeps that from re-walking the whole event
  // each time. Not keyed on the crop, and it must not be — see locationEnergyIndex.
  const energies = useMemo(
    () => logs && locationEnergyIndex(logs, weighting, locations),
    [logs, weighting, locations],
  );

  // And the reverse of the levels: an energetic mean over every minute of the crop for
  // every location, which the playhead cannot change. Keying it on the playhead too
  // would redo all of that on every frame of a scrub for a number that could not have
  // moved — which is why this is its own memo rather than a branch of the one above.
  const locationTotals = useMemo(
    () => energies && totalsByLocation(energies, {start, end}),
    [energies, start, end],
  );

  // Not keyed on the crop or the playhead: uPlot does the cropping, so dragging the
  // timeline leaves this memo untouched and no trace is rebuilt. Ticking a series does
  // rebuild them — those are other columns of the payload, not another slice of the same
  // one — and it rebuilds every picked series', not just the new one's. A cache per series
  // was the alternative: a second index to invalidate, for copying columns that are already
  // in memory, on a gesture nobody makes twice a second.
  //
  // Keyed on a string rather than on the array, in case a caller ever builds it inline —
  // the same trick, and the same reason, as `linesKey` in LevelTrace.
  const pickedKey = picked.join(' ');
  const traces = useMemo(
    () => logs && logSeries(logs, picked),
    [logs, pickedKey],
  );

  // The one shape here keyed on the payload and nothing else — not the crop, the playhead
  // or the pick. It answers "was anything heard at this minute",
  // which none of those four can change (see PRESENCE_COLUMN), so the timeline's shading is
  // computed once per project and then merely re-laid-out.
  const gaps = useMemo(() => logs && coverageGaps(logs), [logs]);

  return {levels, locationTotals, traces, gaps, isFetching};
}
