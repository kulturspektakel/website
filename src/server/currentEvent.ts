import {createServerFn} from '@tanstack/react-start';
import {setResponseHeader} from '@tanstack/react-start/server';
import {queryOptions} from '@tanstack/react-query';
import {getCurrentEvent} from './getCurrentEvent.server';

export const loadEvent = createServerFn({method: 'GET'}).handler(async () => {
  // `stale-while-revalidate` so expiry never makes a visitor wait on a cold SSR
  // render: past the hour the edge serves the stale page immediately and
  // refreshes behind it. Freshness is unchanged; it just removes the blocking
  // re-render (and the origin burst) that plain `s-maxage` causes at expiry.
  setResponseHeader(
    'Cache-Control',
    'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  );
  return {
    event: await getCurrentEvent(),
  };
});

// The current event is needed in three places the `/_main` layout's own loader data
// can't reach: `/_main/booking`'s `head`, and the two card routes' loaders. Route
// context used to carry it there, which is why this lived in `beforeLoad` — but
// `beforeLoad` has no staleness of any kind (`shouldSkipLoader` skips only on
// hydration and SSR-disabled matches), so it re-ran on every navigation.
//
// Going through the query cache instead means every one of those callers can ask for
// it independently and only the first ask costs anything: once per SSR request, once
// per client session.
// Matches the `max-age` the response above declares, so caching for this long adds no
// staleness beyond what the browser's own HTTP cache was already serving. Shared with
// the `/_main` route loader so the two can't drift.
export const CURRENT_EVENT_STALE_TIME = 3600 * 1000;

export const currentEventQuery = queryOptions({
  queryKey: ['currentEvent'],
  queryFn: () => loadEvent(),
  staleTime: CURRENT_EVENT_STALE_TIME,
  // Router loaders don't subscribe, so the default 5 minute `gcTime` would evict
  // this between navigations and quietly undo the caching above.
  gcTime: Infinity,
});
