import {setSelectionCurrent, type ProjectSelection} from './projectSelection';

// What a project page's URL says about how it is being looked at: whether it is live,
// and — while it is not — which slice of the event is on screen. Those two are the page's
// answer to "what am I looking at", which is the part worth being able to send to
// someone; everything else it holds is either a route of its own (which view) or a
// preference kept per browser (which locations, which metric).
//
// Epoch milliseconds, like every instant on this page (see projectSelection.ts). Long in
// a URL, but exact and lossless — a crop dragged onto the quarter hour comes back as the
// same two instants it left as, and there is no second time format to keep in step with
// the first.
export type ProjectSearch = {
  // Absent while live, which is the default: the plain project URL is the live one, and
  // only a page that has been pinned to a window says so.
  live?: false;
  // The crop, and nothing else. The playhead inside it is deliberately not here: it
  // follows the pointer across a row chart, so it changes on every pause of a cursor —
  // an address bar rewritten that often is neither a link worth copying nor a history to
  // press back through, and what the page is *showing* is the window. It stays component
  // state, and a crop arriving from a URL is fitted around wherever it happens to stand.
  //
  // `from`/`to`, like `live` beside them and every other param this page writes: the page
  // is in German, but its URL is not — these are the words every range in every URL is
  // spelled with, and a link someone has to translate before editing it by hand is one
  // word too clever.
  from?: number;
  to?: number;
};

// The router has already JSON-parsed each value, so this is a range check and not a
// parse: anything that isn't a positive whole number of milliseconds is not an instant
// this page could have written, and is treated as absent rather than as zero.
const instant = (value: unknown): number | undefined => {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : undefined;
};

export const validateProjectSearch = (
  search: Record<string, unknown>,
): ProjectSearch => {
  const from = instant(search.from);
  const to = instant(search.to);
  return {
    // A boolean, because the router has already parsed one for us.
    ...(search.live === false ? {live: false as const} : {}),
    // A crop needs both of its ends, so half a range is dropped rather than completed
    // from the window: `resolveProjectSelection` reads any pick at all as one the user
    // made and would pin the page to it.
    ...(from != null && to != null ? {from, to} : {}),
  };
};

// The pick the URL carries, around the playhead the page already has — or null, the
// page's "nothing picked yet", which is what an unpinned URL means and is load-bearing
// (see resolveProjectSelection).
//
// The instant is kept rather than reset: following a link or stepping back changes which
// window is on screen, and there is no reason for it to also move the cursor inside one
// that still contains it. Through setSelectionCurrent, which is the page's one rule for
// putting a playhead in a crop — it pulls one the arriving crop has left behind to the
// nearest edge, exactly as a pan does. With no page to keep — the first render of a
// pinned link — there is no instant at all: the playhead is where a pointer is, and a URL
// carries a window, not a hand (see ProjectSelection).
//
// Not clamped to the project's window here, only to the crop: that is
// resolveProjectSelection's, and it is the only one that knows the window.
export const projectSearchSelection = (
  search: ProjectSearch,
  previous: ProjectSelection | null,
): ProjectSelection | null =>
  search.from != null && search.to != null
    ? setSelectionCurrent(
        {start: search.from, current: null, end: search.to},
        previous?.current ?? null,
      )
    : null;

// And back the other way. The crop only travels while the page is pinned: live means
// "whatever is arriving now", which no pair of instants describes — and the pick that
// switching to live leaves behind is kept in state rather than in the URL, so that
// switching back returns to it.
//
// Every key is named on every branch, `undefined` included, so this is the whole of what
// the page has to say about the URL and a caller can spread it over the search it is
// leaving. A branch that simply omitted a key would leave the param it stands for behind
// in the address bar, and the list of params to clear would have to be kept here *and*
// wherever the spreading happens.
export const projectSearchFor = (
  live: boolean,
  chosen: ProjectSelection | null,
): ProjectSearch =>
  live || !chosen
    ? {live: live ? undefined : false, from: undefined, to: undefined}
    : {live: false, from: chosen.start, to: chosen.end};

// Whether the address bar already says this. Which is both what keeps the page from
// navigating to the URL it is already on — on mount, and again when its own write
// arrives back — and, since the playhead is not in here, what makes every write that
// does happen a place worth pressing back to.
export const sameProjectSearch = (
  a: ProjectSearch,
  b: ProjectSearch,
): boolean => a.live === b.live && a.from === b.from && a.to === b.to;
