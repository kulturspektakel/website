import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {noiseProjectLogs} from '../../routes/crew.lautstaerke';
import {
  levelsByDevice,
  logSeries,
  totalsByDevice,
  type RangeTotals,
} from './projectLogs';
import {noiseQueryKeys} from './queries';
import type {DeviceSeries, Weighting} from './noise';
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
 * for, and it also means SSR never touches this. The three derived shapes are
 * memoized apart because they change on very different things: the levels follow the
 * playhead and both dropdowns, the totals the crop and the weighting, the traces only
 * the payload and the dropdowns. So dragging the timeline leaves the levels and the
 * traces alone, and scrubbing recomputes one small record and nothing else.
 */
export function useProjectLogs({
  projectId,
  live,
  metric,
  weighting,
  selection,
}: {
  projectId: string;
  live: boolean;
  metric: LevelMetric;
  weighting: Weighting;
  selection: ProjectSelection;
}): {
  levels?: Record<string, number>;
  totals?: Record<string, RangeTotals>;
  traces?: Record<string, DeviceSeries>;
  isFetching: boolean;
} {
  const {data: logs, isFetching} = useQuery({
    queryKey: noiseQueryKeys.projectLogs(projectId),
    queryFn: () => noiseProjectLogs({data: {projectId}}),
    enabled: !live,
    ...LOGS_CACHE,
  });

  const {start, end, current} = selection;

  // The playhead's reading, so keyed on the playhead and not on the crop.
  const levels = useMemo(
    () => logs && levelsByDevice(logs, {metric, weighting, current}),
    [logs, metric, weighting, current],
  );

  // And the reverse: an energetic mean over every minute of the crop for every device,
  // which the playhead cannot change. Keying it on the playhead too would redo all of
  // that on every frame of a scrub for a number that could not have moved — which is
  // why this is its own memo rather than a branch of the one above.
  const totals = useMemo(
    () => logs && totalsByDevice(logs, {start, end}, weighting),
    [logs, weighting, start, end],
  );

  // Not keyed on the crop or the playhead: uPlot does the cropping, so dragging the
  // timeline leaves this memo untouched and no trace is rebuilt. Switching the window
  // does rebuild them — that is a different column of the payload, not a different
  // slice of the same one.
  const traces = useMemo(
    () => logs && logSeries(logs, metric, weighting),
    [logs, metric, weighting],
  );

  return {levels, totals, traces, isFetching};
}
