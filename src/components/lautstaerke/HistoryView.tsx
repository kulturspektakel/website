import {useNavigate, useRouter} from '@tanstack/react-router';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Box} from '@chakra-ui/react';
import type uPlot from 'uplot';
import {HISTORY_SERIES} from './series';
import {BigNumberRow, useSeriesToggle} from './BigNumber';
import {NoiseTimeChart} from './NoiseTimeChart';
import {useDeviceView} from './deviceView';
import {fmtDayHourMinute, fmtHourMinute} from './chartUtils';
import {coverageNote, type HistoryTotals} from './leq';
import {MAX_RANGE_MS, rangeSearch} from './timeframe';

// Above this span an HH:MM axis label is ambiguous, so switch to one that also
// carries the day.
const MULTI_DAY_MS = 36 * 60 * 60 * 1000;

// How much wider one zoom-out step makes the window.
const ZOOM_OUT_FACTOR = 4;


export type HistoryData = {
  aligned: (number | null)[][];
  // Leq over the whole window plus its coverage — see historyTotals.
  totals: HistoryTotals;
  // The queried window, epoch ms. Echoed back by the loader so the chart's
  // default x-range is exactly what was asked for, not just what had data.
  start: number;
  end: number;
};

// The historical view for an explicit UTC timeframe. The URL's ?start/?end are
// authoritative: they drive the query, the chart's x-range, and — via zoom — get
// rewritten as the user narrows the window, so any view is linkable.
export function HistoryView({
  device,
  loaderData,
}: {
  device: string;
  loaderData: HistoryData;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const {weighting} = useDeviceView();
  const [cursorIdx, setCursorIdx] = useState<number | 'gap' | null>(null);
  const {shown, toggle} = useSeriesToggle(HISTORY_SERIES);
  const {aligned, totals, start, end} = loaderData;

  // A window reaching into the present keeps accumulating minute-aggregates as
  // they upload; re-run the loader so the chart fills in without a manual reload
  // (fully-past windows never change). Invalidating rather than fetching by hand
  // lets the router own staleness and races — its loader is already keyed on the
  // range, so a poll that lands after we've navigated can't overwrite the new view.
  useEffect(() => {
    if (end <= Date.now()) return;
    const id = setInterval(() => void router.invalidate(), 60_000);
    return () => clearInterval(id);
  }, [router, end]);

  // New identity whenever the samples change (a poll updates it), so the chart
  // re-pushes; zoomResetKey tracks the range separately so a poll keeps the zoom.
  const data = useMemo(() => aligned as unknown as uPlot.AlignedData, [aligned]);

  // A completed zoom gesture becomes the new URL timeframe, so it's linkable and
  // the query narrows with it. null means zoom out: the URL *is* the range, so the
  // chart can't widen on its own (it clamps to what's loaded) — widen the window
  // about its center instead, up to the largest range the query allows.
  const onZoomRange = useCallback(
    (zoom: [number, number] | null) => {
      let next: {start: number; end: number};
      if (zoom) {
        next = {start: zoom[0] * 1000, end: zoom[1] * 1000};
      } else {
        const width = Math.min((end - start) * ZOOM_OUT_FACTOR, MAX_RANGE_MS);
        const mid = (start + end) / 2;
        next = {start: mid - width / 2, end: mid + width / 2};
      }
      void navigate({
        to: '/crew/lautstaerke/$device',
        params: {device},
        search: rangeSearch({
          start: new Date(Math.round(next.start)),
          end: new Date(Math.round(next.end)),
        }),
        replace: true,
      });
    },
    [navigate, device, start, end],
  );

  return (
    <>
      {/* No liveValue: the per-sample numbers stay blank until the cursor hovers
          one. The timeframe Leq is the exception — it describes the whole window,
          so it shows straight away and doesn't move with the cursor. */}
      <BigNumberRow
        series={HISTORY_SERIES}
        weighting={weighting}
        shown={shown}
        toggle={toggle}
        cursorIdx={cursorIdx}
        data={data}
        aggregate={{
          after: 'eq_30m',
          // Unqualified Leq already means "over the measurement period".
          label: weighting === 'A' ? 'LAeq' : 'LCeq',
          // Neutral rather than a stroke colour: there's no line to match.
          color: 'gray.400',
          value: weighting === 'A' ? totals.laeq : totals.lceq,
          sub: coverageNote(totals),
        }}
      />
      <Box flex="1" minH="0" display="flex">
        <NoiseTimeChart
          data={data}
          series={HISTORY_SERIES}
          weighting={weighting}
          shown={shown}
          xRange={() => [start / 1000, end / 1000]}
          xAxisFormat={
            end - start > MULTI_DAY_MS ? fmtDayHourMinute : fmtHourMinute
          }
          gapThresholdX={120}
          zoomable
          zoomResetKey={`${start}|${end}`}
          onZoomRange={onZoomRange}
          // Always offered: the window can widen until it hits MAX_RANGE_MS.
          canZoomOut={end - start < MAX_RANGE_MS}
          onCursorIdx={setCursorIdx}
        />
      </Box>
    </>
  );
}
