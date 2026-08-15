import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {noiseProjectLogs} from '../../routes/crew.lautstaerke';
import {
  levelsByDevice,
  locationEnergyIndex,
  logSeries,
  totalsByLocation,
  type LocationAssignments,
  type MetricTraces,
  type RangeTotals,
} from './projectLogs';
import {noiseQueryKeys} from './queries';
import {logMinuteIndex, type Weighting} from './noise';
import {type LevelMetric} from './level';
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
 * for, and it also means SSR never touches this. The four derived shapes are memoized
 * apart because they change on very different things: the levels follow the playhead's
 * *minute*, the primary window and the weighting; the running totals the payload, the
 * weighting and the assignments; the crop's Leq those totals and the crop; the traces only
 * the payload, the picked windows and the weighting. So dragging the timeline leaves the
 * levels and the traces alone, and scrubbing recomputes one small record — and only when it
 * crosses into a new minute.
 */
export function useProjectLogs({
  projectId,
  live,
  metrics,
  metric,
  weighting,
  selection,
  locations,
}: {
  projectId: string;
  live: boolean;
  // Every window the charts draw, and the primary the numbers are read in — the two halves
  // of one pick (see useLevelPick), and they key different memos below.
  metrics: readonly LevelMetric[];
  metric: LevelMetric;
  weighting: Weighting;
  selection: ProjectSelection;
  // Which placements count as each location's, for the crop Leq below. The pins and
  // the charts resolve their own; this is the one number that has to be summed over
  // the whole crop rather than read at an instant.
  locations: readonly LocationAssignments[];
}): {
  levels?: Record<string, number>;
  locationTotals?: Record<string, RangeTotals>;
  traces?: MetricTraces;
  isFetching: boolean;
} {
  const {data: logs, isFetching} = useQuery({
    queryKey: noiseQueryKeys.projectLogs(projectId),
    queryFn: () => noiseProjectLogs({data: {projectId}}),
    enabled: !live,
    ...LOGS_CACHE,
  });

  const {start, end, current} = selection;

  // The playhead's reading, so keyed on the playhead and not on the crop — and on the
  // minute it stands in rather than the instant, because that is all the payload has.
  // A hover reports a new instant every animation frame, and on any crop shorter than a
  // day most of those frames land in the minute the last one did: keyed on the instant
  // this handed every row and every pin a new record, with the same numbers in it, sixty
  // times a second.
  const minute = logs ? logMinuteIndex(logs, current) : 0;
  const levels = useMemo(
    () => logs && levelsByDevice(logs, {metric, weighting, minute}),
    [logs, metric, weighting, minute],
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
  // timeline leaves this memo untouched and no trace is rebuilt. Ticking a window does
  // rebuild them — those are other columns of the payload, not another slice of the same
  // one — and it rebuilds every window's, not just the new one's. A cache per window was
  // the alternative: a second index to invalidate, for copying columns that are already in
  // memory, on a gesture nobody makes twice a second.
  //
  // Keyed on a string rather than on the array, in case a caller ever builds it inline —
  // the same trick, and the same reason, as `linesKey` in LevelTrace.
  const metricsKey = metrics.join(' ');
  const traces = useMemo(
    () => logs && logSeries(logs, metrics, weighting),
    [logs, metricsKey, weighting],
  );

  return {levels, locationTotals, traces, isFetching};
}
