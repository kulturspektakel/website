import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {noiseProjectLogs} from '../../routes/crew.noise';
import {
  locationEnergyIndex,
  logSeries,
  rangeLimitVerdicts,
  runningLeqByLocation,
  seriesLevelsByDevice,
  totalsByLocation,
  type LocationAssignments,
  type PlayheadLevels,
  type RangeByWeighting,
  type RangeTotals,
  type RangeVerdict,
  type SeriesTraces,
} from './projectLogs';
import {coverageGaps, limitBreaches, type LogGap} from './logCoverage';
import type {LimitLine} from './limitLines';
import {noiseQueryKeys} from './queries';
import {logMinuteIndex, type Weighting} from './noise';
import {type PickedSeries, type RangePick} from './level';
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
 * alone; the running totals the payload, the picked range weightings and the assignments;
 * the crop's Leq those totals and the crop, its running line only the crop's start; the
 * traces only the payload and the pick; the coverage gaps the payload alone. So dragging the timeline leaves the levels, the traces
 * and the gaps alone, and scrubbing recomputes one small record — and only when it crosses
 * into a new minute.
 */
export function useProjectLogs({
  projectId,
  live,
  picked,
  range,
  selection,
  locations,
  timeline,
}: {
  projectId: string;
  live: boolean;
  // Every series the charts draw. The playhead's record carries all nine whatever is
  // picked (see seriesLevelsByDevice), so changing what the header prints recomputes
  // nothing there — only the traces follow the pick.
  picked: PickedSeries;
  // Which weightings of the crop's Leq are wanted (see RangePick). Nothing is summed for
  // one that isn't.
  range: RangePick;
  selection: ProjectSelection;
  // Which placements count as each location's, for the crop Leq below. The pins and
  // the charts resolve their own; this is the one number that has to be summed over
  // the whole crop rather than read at an instant. With the place's limits, for the ones
  // written against a `Leq,Range` (see rangeLimitVerdicts).
  locations: readonly (LocationAssignments & {
    limits: readonly LimitLine[];
  })[];
  // Which places the timeline speaks for: the ones on screen, with their limits. `all` is
  // the map, where every place is on screen at once — the coverage is then every device's,
  // rather than only what stood at these places. Memoized by the caller, since both
  // shapes below are keyed on it.
  timeline: {
    locations: readonly (LocationAssignments & {
      limits: readonly LimitLine[];
    })[];
    all: boolean;
  };
}): {
  levels?: PlayheadLevels;
  // Per picked range weighting: each location's Leq over the crop, and its running Leq from
  // the crop's start on the traces' minute grid (see runningLeq).
  locationTotals?: RangeByWeighting<RangeTotals>;
  rangeTraces?: RangeByWeighting<(number | null)[]>;
  // Per picked range weighting and location: the `Leq,Range` limits overlapping the crop
  // whose own hours came to more than they allow.
  rangeOver?: RangeByWeighting<RangeVerdict[]>;
  traces?: SeriesTraces;
  // The stretches of the event nobody reported in, which the timeline shades. Absent
  // while live and while the payload is in flight, so the strip draws nothing rather
  // than claiming the whole festival is missing.
  gaps?: LogGap[];
  // Where one of those places read over a limit in a picked series. Null when none of
  // them has a limit for any, so the strip draws no limit layer at all; absent like `gaps`.
  breaches?: LogGap[] | null;
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
  // Absent until the payload is in, and while live (see `logs`) — the playhead itself is
  // always somewhere (see ProjectSelection).
  const minute = logs ? logMinuteIndex(logs, current) : null;
  const levels = useMemo(
    () =>
      logs && minute != null ? seriesLevelsByDevice(logs, {minute}) : undefined,
    [logs, minute],
  );

  // The running totals every crop's Leq is read off, which depend on neither end of
  // it: dragging the timeline is the gesture that asks for those Leqs, once a frame
  // for every location, and this is what keeps that from re-walking the whole event
  // each time. Not keyed on the crop, and it must not be — see locationEnergyIndex.
  //
  // One per picked weighting — an energetic mean is one number over one column — and keyed
  // on a string for the reason `traces` is below.
  const rangeKey = range.join(' ');
  const energies = useMemo(
    () =>
      logs &&
      range.map(
        (weighting) =>
          [weighting, locationEnergyIndex(logs, weighting, locations)] as const,
      ),
    [logs, rangeKey, locations],
  );

  // And the reverse of the levels: an energetic mean over every minute of the crop for
  // every location, which the playhead cannot change. Keying it on the playhead too
  // would redo all of that on every frame of a scrub for a number that could not have
  // moved — which is why this is its own memo rather than a branch of the one above.
  const locationTotals = useMemo(
    () =>
      energies &&
      byWeighting(energies, (index) => totalsByLocation(index, {start, end})),
    [energies, start, end],
  );

  // The same mean as a line, from the crop's start — restarting inside each `Leq,Range`
  // limit at the limit's own start (see runningLeq). Not keyed on the end: the line runs to
  // the end of the payload and uPlot crops it, so only moving the start redraws it.
  const rangeTraces = useMemo(
    () =>
      energies &&
      byWeighting(energies, (index, weighting) =>
        runningLeqByLocation(index, weighting, start, locations),
      ),
    [energies, start, locations],
  );

  // Which of those limits the cards warn about: judged on their own hours, and only the
  // ones the crop overlaps.
  const rangeOver = useMemo(
    () =>
      energies &&
      byWeighting(energies, (index, weighting) =>
        Object.fromEntries(
          locations.flatMap((location) => {
            const over = rangeLimitVerdicts(index, weighting, location, {
              start,
              end,
            });
            return over.length === 0 ? [] : [[location.id, over]];
          }),
        ),
      ),
    [energies, start, end, locations],
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

  // Keyed on the payload and the places on screen — not the crop, the playhead or the pick.
  // It answers "was anything heard here at this minute", which none of those three can
  // change (see PRESENCE_COLUMN), so the timeline's shading is recomputed only when the
  // view or the list's places change, and is otherwise merely re-laid-out.
  const gaps = useMemo(
    () =>
      logs &&
      coverageGaps(
        logs,
        // Every device at once is the cheaper question, but it cannot know what was
        // ignored where — so with any tag in play, even "every place" is asked place by
        // place.
        timeline.all && !timeline.locations.some((l) => l.ignored?.length)
          ? undefined
          : timeline.locations,
      ),
    [logs, timeline],
  );

  // The same places against their limits, in every series picked — each one a chart
  // draws a limit's rule for (see limitBreaches) — and in every picked `Leq,Range`. Keyed
  // on the string for the reason `traces` is.
  const breaches = useMemo(
    () =>
      logs &&
      limitBreaches(
        logs,
        timeline.locations,
        picked,
        (energies ?? []).map(([weighting, index]) => ({weighting, index})),
      ),
    [logs, timeline, pickedKey, energies],
  );

  return {
    levels,
    locationTotals,
    rangeTraces,
    rangeOver,
    traces,
    gaps,
    breaches,
    isFetching,
  };
}

const byWeighting = <I, T>(
  indexes: readonly (readonly [Weighting, I])[],
  read: (index: I, weighting: Weighting) => Record<string, T>,
): RangeByWeighting<T> =>
  Object.fromEntries(indexes.map(([w, index]) => [w, read(index, w)]));
