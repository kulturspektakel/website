import {createFileRoute, notFound, redirect} from '@tanstack/react-router';
import {dayRangeSearch} from '../components/lautstaerke/timeframe';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Legacy shape: the viewed day used to be a path param. The timeframe now lives
// in ?start/?end as UTC instants, so translate bookmarked day URLs into the
// equivalent full-day range instead of 404ing them.
export const Route = createFileRoute('/crew/lautstaerke/$device/$date')({
  beforeLoad: ({params}) => {
    if (!DATE_RE.test(params.date)) throw notFound();
    throw redirect({
      to: '/crew/lautstaerke/$device',
      params: {device: params.device},
      search: dayRangeSearch(params.date),
    });
  },
});
