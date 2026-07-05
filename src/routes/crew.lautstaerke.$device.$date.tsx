import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {useMemo, useState} from 'react';
import {Box} from '@chakra-ui/react';
import type uPlot from 'uplot';
import {HISTORY_SERIES} from '../components/lautstaerke/context';
import {
  BigNumberRow,
  useSeriesToggle,
} from '../components/lautstaerke/BigNumber';
import {NoiseTimeChart} from '../components/lautstaerke/NoiseTimeChart';
import {deviceTitle, useDeviceView} from '../components/lautstaerke/deviceView';
import {fmtHourMinute} from '../components/lautstaerke/chartUtils';
import {
  localDayRange,
  noiseHistory,
  rowsToAligned,
} from '../server/noiseHistory.server';
import {seo} from '../utils/seo';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const loadHistory = createServerFn()
  .middleware([crewAuth])
  .inputValidator((d: {device: string; date: string}) => d)
  .handler(async ({data}) => {
    if (!DATE_RE.test(data.date)) throw notFound();
    const rows = await noiseHistory(data.device, data.date);
    const {start, end} = localDayRange(data.date);
    return {
      aligned: rowsToAligned(rows),
      start: start.getTime(),
      end: end.getTime(),
    };
  });

export const Route = createFileRoute('/crew/lautstaerke/$device/$date')({
  component: DeviceHistory,
  loader: async ({params}) =>
    loadHistory({data: {device: params.device, date: params.date}}),
  head: ({matches, params}) =>
    seo({
      title: `Lautstärke – ${deviceTitle(matches, params.device, params.date)} – ${params.date}`,
    }),
});

function DeviceHistory() {
  const {aligned, start, end} = Route.useLoaderData();
  const {weighting} = useDeviceView();
  const [cursorIdx, setCursorIdx] = useState<number | 'gap' | null>(null);
  const {shown, toggle} = useSeriesToggle(HISTORY_SERIES);

  // Stable per loaded day, so NoiseTimeChart re-pushes only when the day changes.
  const data = useMemo(
    () => aligned as unknown as uPlot.AlignedData,
    [aligned],
  );

  return (
    <>
      {/* No liveValue: the numbers stay blank until the cursor hovers a sample. */}
      <BigNumberRow
        series={HISTORY_SERIES}
        weighting={weighting}
        shown={shown}
        toggle={toggle}
        cursorIdx={cursorIdx}
        data={data}
      />
      <Box flex="1" minH="0" display="flex">
        <NoiseTimeChart
          data={data}
          series={HISTORY_SERIES}
          weighting={weighting}
          shown={shown}
          xRange={() => [start / 1000, end / 1000]}
          xAxisFormat={fmtHourMinute}
          gapThresholdX={120}
          zoomable
          onCursorIdx={setCursorIdx}
        />
      </Box>
    </>
  );
}
