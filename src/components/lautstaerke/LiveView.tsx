import {useMemo, useState} from 'react';
import {Flex} from '@chakra-ui/react';
import type uPlot from 'uplot';
import {useNoiseLive} from './context';
import {GAP_THRESHOLD_S, WINDOW_S} from './noise';
import {LIVE_SERIES, emptyBuffer} from './series';
import {BigNumberRow, useSeriesToggle} from './BigNumber';
import {NoiseTimeChart} from './NoiseTimeChart';
import {BandSpectrumChart} from './BandSpectrumChart';
import {useDeviceView} from './deviceView';
import {fmtTime} from './chartUtils';

// The live view: rolling time chart plus the 1/3-octave band spectrum, driven by
// the MQTT records in the shared context. Rendered by the $device index route
// whenever the URL carries no timeframe.
export function LiveView({device}: {device: string}) {
  const ctx = useNoiseLive();
  const {weighting, peaks} = useDeviceView();
  // Chart cursor: null when not hovering (big numbers show live values), a
  // buffer index for the hovered sample, or 'gap' when the cursor sits in a
  // region with no nearby sample (big numbers show — rather than stale data).
  const [cursorIdx, setCursorIdx] = useState<number | 'gap' | null>(null);
  const {shown, toggle} = useSeriesToggle(LIVE_SERIES);

  // This view can mount before the device's first record arrives, and only
  // ingest may create a buffer — so stand in an empty one of the right width
  // until it does, rather than writing to shared state during a render.
  //
  // The swap is safe because the chart re-reads this every second off a latest-
  // value ref, and re-applies immediately when the identity changes: the same
  // ingest call that creates the real buffer also schedules the re-render that
  // hands it over.
  const placeholder = useMemo(() => emptyBuffer(), []);
  const data = (ctx.deviceData.current[device] ??
    placeholder) as unknown as uPlot.AlignedData;

  const deviceState = ctx.devices[device];
  const latest = deviceState?.latest ?? null;

  return (
    <>
      <BigNumberRow
        series={LIVE_SERIES}
        weighting={weighting}
        shown={shown}
        toggle={toggle}
        cursorIdx={cursorIdx}
        data={data}
        liveValue={(s) => (latest ? s.get(latest) : null)}
      />
      <Flex flex="1" minH="0" direction={{base: 'column', lg: 'row'}} gap="2">
        <NoiseTimeChart
          live
          data={data}
          series={LIVE_SERIES}
          weighting={weighting}
          shown={shown}
          xRange={() => {
            const max = Date.now() / 1000;
            return [max - WINDOW_S, max];
          }}
          xAxisFormat={fmtTime}
          gapThresholdX={GAP_THRESHOLD_S}
          onCursorIdx={setCursorIdx}
        />
        <BandSpectrumChart
          device={device}
          state={deviceState}
          peaks={peaks}
          weighting={weighting}
        />
      </Flex>
    </>
  );
}
