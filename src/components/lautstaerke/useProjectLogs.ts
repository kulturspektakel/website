import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {noiseProjectLogs} from '../../routes/crew.lautstaerke';
import {levelsByDevice, logSeries} from './projectLogs';
import {noiseQueryKeys} from './queries';
import type {DeviceSeries, Weighting} from './noise';
import {isPointMetric, type LevelMetric} from './level';
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
 * for, and it also means SSR never touches this. The two derived shapes are memoized
 * apart because they change on very different things: the levels follow the playhead
 * and both dropdowns, the traces only the payload and the weighting. So dragging the
 * timeline recomputes one small record and nothing else.
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

  // Two memos, each keyed on what its own metric reads, rather than one keyed on the
  // union: an instantaneous window ignores the crop, and the range Leq ignores the
  // playhead. The omitted dependency is the point of each — the range Leq is an
  // energetic mean over every minute of the crop for every device, so keying it on the
  // playhead too would recompute it on every frame of a scrub for a number that cannot
  // have changed. (One memo can't do this: a dependency array may not change length.)
  const point = isPointMetric(metric);
  const range = {start, end};
  const atPlayhead = useMemo(
    () =>
      logs && point
        ? levelsByDevice(logs, {metric, weighting, current, range})
        : undefined,
    [logs, point, metric, weighting, current],
  );
  const overRange = useMemo(
    () =>
      logs && !point
        ? levelsByDevice(logs, {metric, weighting, current, range})
        : undefined,
    [logs, point, metric, weighting, start, end],
  );
  const levels = point ? atPlayhead : overRange;

  // Not keyed on the crop: uPlot does the cropping, so dragging the timeline leaves
  // this memo untouched and no trace is rebuilt.
  const traces = useMemo(
    () => logs && logSeries(logs, weighting),
    [logs, weighting],
  );

  return {levels, traces, isFetching};
}
