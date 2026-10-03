import type {AnyRouter} from '@tanstack/react-router';

// Which route each entry of this tab's history is on, so a back button can step past every
// entry on the route it is already on. Route, not URL: the noise project page pushes an
// entry for every crop and every switch in or out of live, and moving from one monitor to the
// next is the same page about another device — a back arrow that walked out through those
// would feel broken, when what it is asked is "back to where I came from".
//
// The browser shows nobody its history, so this keeps its own record: TanStack's history
// stamps every entry with its position (`__TSR_index`), and every entry this tab lands on —
// pushed, replaced, or reached by back and forward — is written down against it, with the id
// of the deepest route it matched. In session storage, which lives exactly as long as the
// tab's history does, so a reload keeps the trail. Entries from before the app was loaded
// (another site, a bookmark) are simply unknown.
const STORAGE_KEY = 'historyRoutes';

let routes: Record<number, string> = {};
// Which routers are subscribed, so each is subscribed once. They all write the one record
// above — in the app there is only ever the one router; a test makes one per case.
const tracked = new WeakSet<AnyRouter>();

const indexOf = (router: AnyRouter): number | undefined =>
  router.history.location.state.__TSR_index;

const routeOf = (router: AnyRouter): string | undefined =>
  router.state.matches.at(-1)?.routeId;

function load() {
  try {
    routes = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    routes = {};
  }
}

function record(router: AnyRouter) {
  const index = indexOf(router);
  const route = routeOf(router);
  if (index == null || route == null || routes[index] === route) return;
  routes[index] = route;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch {
    // A full storage costs the memory, not the page: back falls back to its link.
  }
}

// Starts the record. Browser only, and once per router however often it is called. On every
// resolved navigation — a push, a replace, a back or forward — which is when the router
// knows which route the entry it landed on is.
export function trackHistoryRoutes(router: AnyRouter): void {
  if (tracked.has(router)) return;
  tracked.add(router);
  load();
  record(router);
  router.subscribe('onResolved', () => record(router));
}

/**
 * How far back the nearest entry on another route is — a negative step for `history.go` —
 * or null when that isn't known: nothing before this entry, or an entry this tab's record
 * never saw. Only entries behind this one are read, and every one of those was recorded when
 * it was last landed on, so the ones a later push discarded ahead of it never mislead.
 */
export function stepsBackToOtherRoute(router: AnyRouter): number | null {
  const index = indexOf(router);
  const here = routeOf(router);
  if (index == null || here == null) return null;
  for (let i = index - 1; i >= 0; i--) {
    const route = routes[i];
    if (route == null) return null;
    if (route !== here) return i - index;
  }
  return null;
}
