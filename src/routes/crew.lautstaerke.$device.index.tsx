import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {LiveView} from '../components/lautstaerke/LiveView';
import {
  HistoryView,
  type HistoryData,
} from '../components/lautstaerke/HistoryView';
import {parseRangeSearch} from '../components/lautstaerke/timeframe';
import {historyTotals} from '../components/lautstaerke/leq';
import {rowsToAligned} from '../components/lautstaerke/series';
import {noiseHistory} from '../server/noiseHistory.server';

// Loads one device's minute-aggregates for an explicit UTC window. The range
// arrives as the same ISO strings the URL carries; parseRangeSearch is the single
// place they're turned into instants, so a hand-edited URL can't reach the query
// unvalidated. The window is echoed back (epoch ms) as the chart's x-range.
const loadHistory = createServerFn()
  .middleware([crewAuth])
  .inputValidator((d: {device: string; start: string; end: string}) => d)
  .handler(async ({data}): Promise<HistoryData> => {
    const range = parseRangeSearch(data);
    if (!range) throw notFound();
    const rows = await noiseHistory(data.device, range.start, range.end);
    return {
      aligned: rowsToAligned(rows),
      totals: historyTotals(rows, range.start, range.end),
      start: range.start.getTime(),
      end: range.end.getTime(),
    };
  });

export const Route = createFileRoute('/crew/lautstaerke/$device/')({
  component: DeviceView,
  // ?start/?end are validated on the $device layout and inherited here. Their
  // presence is what selects the historical view, so the loader is a no-op for
  // the live one.
  loaderDeps: ({search}) => ({start: search.start, end: search.end}),
  loader: ({params, deps}) =>
    deps.start && deps.end
      ? loadHistory({
          data: {device: params.device, start: deps.start, end: deps.end},
        })
      : null,
});

// One leaf route for both views: a timeframe in the URL means history, its
// absence means live. Keeping them on the same route is what lets the timeframe
// be a search param on the shared $device layout rather than a path segment. The
// branch reads the same predicate the loader does, so the two can't drift.
function DeviceView() {
  const {device} = Route.useParams();
  const {start, end} = Route.useSearch();
  const loaderData = Route.useLoaderData();

  if (!start || !end || !loaderData) return <LiveView device={device} />;
  return <HistoryView device={device} loaderData={loaderData} />;
}
