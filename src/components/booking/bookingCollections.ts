import {
  createRealtimeClient,
  pgTypeOids,
  type RealtimeClient,
} from '@neon/realtime/client';
import {realtimeCollectionOptions} from '@neon/realtime-tanstack';
import {
  type Collection,
  createCollection,
  type NonSingleResult,
  type Transaction,
  useLiveQuery,
  type WithVirtualProps,
} from '@tanstack/react-db';
import type {
  bandApplication,
  bandApplicationComment,
  bandApplicationRating,
  bandApplicationTag,
  viewer,
} from '../../server/db/schema';
import {addBandApplicationTag} from '../../server/addBandApplicationTag';
import {deleteBandApplicationComment} from '../../server/deleteBandApplicationComment';
import {postBandApplicationComment} from '../../server/postBandApplicationComment';
import {rateBandApplication} from '../../server/rateBandApplication';
import {refreshBookingQueries} from '../../server/refreshBookingQueries';
import {removeBandApplicationTag} from '../../server/removeBandApplicationTag';
import {setBandApplicationStage} from '../../server/setBandApplicationStage';
import {errorToast} from '../toast';

// Row types of the booking page's live queries (see `sealBookingQueries`),
// picked from the table types so a schema change shows up here. (Type-only:
// nothing of the schema module reaches the browser.)

type BandApplication = typeof bandApplication.$inferSelect;
type BandApplicationComment = typeof bandApplicationComment.$inferSelect;
type BandApplicationRating = typeof bandApplicationRating.$inferSelect;
type BandApplicationTag = typeof bandApplicationTag.$inferSelect;
type Viewer = typeof viewer.$inferSelect;

type ViewerProfile = Pick<Viewer, 'displayName' | 'profilePicture'>;

export type BookingApplication = Pick<
  BandApplication,
  | 'id'
  | 'createdAt'
  | 'bandname'
  | 'genre'
  | 'genreCategory'
  | 'imageUrl'
  | 'city'
  | 'distance'
  | 'numberOfNonMaleArtists'
  | 'instagramFollower'
  | 'facebookLikes'
  | 'spotifyMonthlyListeners'
  | 'contactedByViewerId'
  | 'stageRow'
  | 'stageColumn'
>;

export type BookingRating = Pick<
  BandApplicationRating,
  'viewerId' | 'bandApplicationId' | 'rating'
> &
  ViewerProfile;

export type BookingTag = Pick<BandApplicationTag, 'bandApplicationId' | 'tag'>;

export type BookingComment = Pick<
  BandApplicationComment,
  'id' | 'createdAt' | 'viewerId' | 'bandApplicationId' | 'comment'
> &
  ViewerProfile;

type SealedBookingQueries = Awaited<ReturnType<typeof refreshBookingQueries>>;

// How long a write waits for its own change to come back over Realtime. Keep it
// short: while a handler waits, TanStack DB holds back the collection's synced
// changes, including other crew members' edits. Past it the write still counts
// as saved (see `persistEach`).
const ECHO_TIMEOUT_MS = 10_000;

export const ratingKey = (viewerId: string, bandApplicationId: string) =>
  `${viewerId}:${bandApplicationId}`;

// `tag` is citext in the database, so "Rock" and "rock" are the same tag. Every
// client-side comparison of tags goes through this.
export const normalizeTag = (tag: string) => tag.trim().toLowerCase();

export const tagKey = (bandApplicationId: string, tag: string) =>
  `${bandApplicationId}:${normalizeTag(tag)}`;

export const hasTag = (tags: string[], tag: string) =>
  tags.some((t) => normalizeTag(t) === normalizeTag(tag));

// Prisma stores timestamps as zone-less UTC (`timestamp(3)`), but the client's
// default reads zone-less timestamps as browser-local time, like node-postgres.
const parseUtcTimestamp = (value: string) =>
  new Date(`${value.replace(' ', 'T')}Z`);

// Resolves once the tab is visible. Sealed queries expire after 60 s and the
// SDK renews them ~10 s before that on a timer, so without this every
// background tab would call the server about once a minute. A hidden tab's
// subscriptions go stale instead and reload their rows when it's shown again.
function whenVisible() {
  if (document.visibilityState === 'visible') {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const onChange = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', onChange);
  });
}

// All of an event's sealed queries expire together, so their refresh timers
// fire together too. Share one server call between them, and keep its result
// for whoever asks next:
// - a fresh seal until shortly before the SDK's refresh window (10 s before
//   expiry), so a retried renewal reuses it instead of minting another;
// - a failure for a doubling delay (2 s up to 1 min). The SDK retries a failed
//   refresh every second, indefinitely, and a tab whose session expired would
//   otherwise call the server that often for as long as it stays open.
const refreshes = new Map<string, Promise<SealedBookingQueries>>();
const failedRefreshes = new Map<string, number>();
function refreshSealed(eventId: string) {
  let refresh = refreshes.get(eventId);
  if (!refresh) {
    refresh = whenVisible().then(() =>
      refreshBookingQueries({data: {eventId}}),
    );
    refreshes.set(eventId, refresh);
    const forget = (afterMs: number) =>
      setTimeout(() => refreshes.delete(eventId), Math.max(0, afterMs));
    refresh.then(
      (sealed) => {
        failedRefreshes.delete(eventId);
        forget(sealed.applications.expiresAt - Date.now() - 15_000);
      },
      () => {
        const failures = (failedRefreshes.get(eventId) ?? 0) + 1;
        failedRefreshes.set(eventId, failures);
        forget(Math.min(60_000, 1_000 * 2 ** failures));
      },
    );
  }
  return refresh;
}

// Writes to the same row go to the server one at a time, in the order they
// were made, so two quick edits of the same thing (3 stars, then 4; removing a
// tag and adding it back) can't commit out of order. Writes to different rows
// don't wait for each other. Keyed by TanStack DB's `globalKey`.
const writeQueues = new Map<string, Promise<unknown>>();
function enqueueWrite<T>(key: string, write: () => Promise<T>) {
  const written = (writeQueues.get(key) ?? Promise.resolve()).then(write);
  const tail = written.catch(() => {});
  writeQueues.set(key, tail);
  tail.then(() => {
    if (writeQueues.get(key) === tail) {
      writeQueues.delete(key);
    }
  });
  return written;
}

// A mutation handler that persists a transaction's mutations through the write
// queue, each waiting for its own change to come back over Realtime. A failed
// server call throws, which rolls the optimistic change back.
function persistEach<Mutation>(
  write: (mutation: Mutation) => Promise<{txid: string}>,
) {
  return async ({
    transaction,
    collection,
  }: {
    transaction: {mutations: (Mutation & {globalKey: string})[]};
    collection: {
      utils: {awaitTxId: (txid: string, timeout?: number) => Promise<boolean>};
    };
  }) => {
    for (const mutation of transaction.mutations) {
      const {txid} = await enqueueWrite(mutation.globalKey, () =>
        write(mutation),
      );
      // Committed by now. If the change doesn't come back in time (e.g. while
      // live updates reconnect), don't throw: that would roll back a saved
      // write, and a re-posted comment would be a duplicate. The stream
      // delivers it once it catches up.
      await collection.utils
        .awaitTxId(txid, ECHO_TIMEOUT_MS)
        .catch(() => undefined);
    }
  };
}

// One WebSocket for every subscription on the page.
let client: RealtimeClient | undefined;

function createBookingCollections(
  eventId: string,
  sealed: SealedBookingQueries,
) {
  const realtimeClient = (client ??= createRealtimeClient({
    url: sealed.url,
    parsers: {[pgTypeOids.timestamp]: parseUtcTimestamp},
  }));
  const live = <Name extends Exclude<keyof SealedBookingQueries, 'url'>>(
    name: Name,
  ) => ({
    id: `booking-${name}:${eventId}`,
    client: realtimeClient,
    query: sealed[name],
    refreshQuery: () => refreshSealed(eventId).then((s) => s[name]),
    // Never garbage-collect: `@neon/realtime-tanstack` 0.1 resubscribes a
    // restarted collection with the seal it was created with, long expired by
    // then. So the booking route owns the lifetime instead (its loader
    // creates the collections, leaving it disposes them). Once the SDK
    // resubscribes with a current seal, the default gcTime would do.
    gcTime: 0,
  });

  // Inserting and changing a rating go through the same server fn; clearing
  // it is rating 0.
  const rate = persistEach((m: {modified: BookingRating}) =>
    rateBandApplication({
      data: {
        applicationId: m.modified.bandApplicationId,
        rating: m.modified.rating,
      },
    }),
  );

  return {
    applications: createCollection(
      realtimeCollectionOptions({
        ...live('applications'),
        getKey: (a: BookingApplication) => a.id,
        // The only field edited from the booking page is the stage.
        onUpdate: persistEach((m: {modified: BookingApplication}) =>
          setBandApplicationStage({
            data: {
              applicationId: m.modified.id,
              row: m.modified.stageRow,
              col: m.modified.stageColumn,
            },
          }),
        ),
      }),
    ),
    ratings: createCollection(
      realtimeCollectionOptions({
        ...live('ratings'),
        getKey: (r: BookingRating) =>
          ratingKey(r.viewerId, r.bandApplicationId),
        onInsert: rate,
        onUpdate: rate,
        onDelete: persistEach((m: {original: BookingRating}) =>
          rateBandApplication({
            data: {applicationId: m.original.bandApplicationId, rating: 0},
          }),
        ),
      }),
    ),
    tags: createCollection(
      realtimeCollectionOptions({
        ...live('tags'),
        getKey: (t: BookingTag) => tagKey(t.bandApplicationId, t.tag),
        onInsert: persistEach((m: {modified: BookingTag}) =>
          addBandApplicationTag({
            data: {
              applicationId: m.modified.bandApplicationId,
              tag: m.modified.tag,
            },
          }),
        ),
        onDelete: persistEach((m: {original: BookingTag}) =>
          removeBandApplicationTag({
            data: {
              applicationId: m.original.bandApplicationId,
              tag: m.original.tag,
            },
          }),
        ),
      }),
    ),
    comments: createCollection(
      realtimeCollectionOptions({
        ...live('comments'),
        getKey: (c: BookingComment) => c.id,
        // The client picks the comment id (see `postBandApplicationComment`),
        // so the optimistic comment and the synced one share a key.
        onInsert: persistEach((m: {modified: BookingComment}) =>
          postBandApplicationComment({
            data: {
              id: m.modified.id,
              applicationId: m.modified.bandApplicationId,
              comment: m.modified.comment,
            },
          }),
        ),
        onDelete: persistEach((m: {original: BookingComment}) =>
          deleteBandApplicationComment({data: {commentId: m.original.id}}),
        ),
      }),
    ),
  };
}

type BookingCollections = ReturnType<typeof createBookingCollections>;

// One set of collections per event, from the booking route's loader until the
// route is left (`disposeBookingCollections`). Browser-only (the route has
// `ssr: false`), so there is no per-request state to keep apart; switching
// users is a full page load.
const collections = new Map<string, BookingCollections>();

// Called by the booking loader: creates the event's collections when the route
// is entered and waits for their first complete results, so the route's
// pending UI covers them. Their own refresh keeps the seals fresh after that.
export async function preloadBookingCollections(
  eventId: string,
  sealed: SealedBookingQueries,
) {
  let event = collections.get(eventId);
  if (!event) {
    event = createBookingCollections(eventId, sealed);
    collections.set(eventId, event);
  }
  await Promise.all(Object.values(event).map((c) => c.preload()));
}

// Called when the booking route is left: stops the event's subscriptions and
// seal refreshes, and closes the WebSocket once no event is open any more.
export async function disposeBookingCollections(eventId: string) {
  const event = collections.get(eventId);
  if (!event) {
    return;
  }
  collections.delete(eventId);
  await Promise.all(Object.values(event).map((c) => c.cleanup()));
  if (collections.size === 0) {
    client?.close();
    client = undefined;
  }
}

export function bookingCollections(eventId: string) {
  const event = collections.get(eventId);
  if (!event) {
    throw new Error(`Booking collections for ${eventId} were not preloaded`);
  }
  return event;
}

type RowOf<C> =
  C extends Collection<infer Row, infer Key, any, any, any>
    ? WithVirtualProps<Row, Key>
    : never;

// The current rows of a collection, re-rendering on every change. Subscribes
// to the collection itself (no derived query). Each row carries TanStack DB's
// `$synced`, false while it's still an optimistic write; the hook's types just
// don't declare it.
export function useLiveRows<
  C extends Collection<any, any, any, any, any> & NonSingleResult,
>(collection: C) {
  return useLiveQuery(collection).data as RowOf<C>[];
}

// Optimistic writes roll themselves back when the server call fails; this says
// why.
export function toastOnFailure(tx: Transaction, title: string) {
  tx.isPersisted.promise.catch(errorToast(title));
}
