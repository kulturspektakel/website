import {sub} from 'date-fns';
import {prismaClient} from './prismaClient.server';
import {ApiError} from './apiError.server';
import {ownTracksPassword} from './ownTracksPassword.server';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/owntracks.ts`.
 *
 * OwnTracks HTTP ingest. The phone app POSTs location updates here using HTTP
 * Basic Auth (username = viewer id, password = ownTracksPassword(id)). On a
 * `location` message we persist a `ViewerLocation`, and we always respond with
 * the "friends" cards+locations of viewers seen in the last 5h (the OwnTracks
 * map). The avatar `face` is omitted (legacy used Jimp to resize; not worth a
 * native image dep here).
 */
enum Mode {
  MQTT = 0,
  HTTP = 3,
}
enum Monitoring {
  Quiet = -1,
  Manual = 0,
  Significant = 1,
  Move = 2,
}
enum BatteryStatus {
  Unknown = 0,
}

type LocationMessage = {
  _type: 'location';
  lat: number;
  lon: number;
  tst: number;
  tid?: string;
  topic?: string;
  created_at?: number;
  bs?: BatteryStatus;
};
type OwnTracksMessage =
  | LocationMessage
  | {_type: 'waypoint' | 'waypoints'; [k: string]: unknown};

type Viewer = {id: string; displayName: string; profilePicture: string | null};

function tid(viewer: {displayName: string}): string {
  return viewer.displayName
    .toLocaleUpperCase()
    .split(' ')
    .slice(0, 2)
    .map((a) => a.charAt(0))
    .join('');
}

/** base64-encoded OwnTracks device config, embedded in the `/owntracks/config` link. */
export function configString(viewer: Viewer): string {
  const config = {
    _type: 'configuration',
    mode: Mode.HTTP,
    url: `${process.env.SITE_URL}/api/owntracks`,
    monitoring: Monitoring.Significant,
    auth: true,
    username: viewer.id,
    password: ownTracksPassword(viewer.id),
    tid: tid(viewer),
    cmd: true,
  };
  return Buffer.from(JSON.stringify(config)).toString('base64');
}

function viewerIdFromBasicAuth(request: Request): string | undefined {
  const [scheme, encoded] = (
    request.headers.get('authorization') ?? ''
  ).split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return undefined;
  }
  const [name, ...rest] = Buffer.from(encoded, 'base64')
    .toString('utf-8')
    .split(':');
  return name && ownTracksPassword(name) === rest.join(':') ? name : undefined;
}

/** Cache of profilePicture URL → base64 image data (the OwnTracks card `face`). */
const faceCache = new Map<string, string>();

/**
 * Fetch a viewer's avatar and base64-encode it for the OwnTracks card `face`,
 * which the app renders as the friend's map pin + list image. This is how we
 * identify friends visually while keeping `tid` = the (unique but unsightly)
 * viewer id. Cached by URL so this frequently-hit ingest endpoint doesn't
 * refetch on every location POST; the Slack CDN URL changes when a user swaps
 * their photo, so the cache self-invalidates. Returns '' on any failure — a
 * missing face just falls back to the tid badge.
 */
async function avatarFace(url: string | null): Promise<string> {
  if (!url) return '';
  // We store the 192px avatar (reused by web UI); the map pin only needs a
  // small image, so request a 48px variant. Slack serves `_48` for uploaded
  // avatars and `s=48` for gravatar fallbacks; other URLs fetch unchanged.
  const small = url.replace('_192.', '_48.').replace('s=192', 's=48');
  const cached = faceCache.get(small);
  if (cached != null) return cached;
  try {
    const res = await fetch(small);
    if (!res.ok) return '';
    const face = Buffer.from(await res.arrayBuffer()).toString('base64');
    faceCache.set(small, face);
    return face;
  } catch {
    return '';
  }
}

export async function handleOwnTracks(request: Request): Promise<Response> {
  const viewerId = viewerIdFromBasicAuth(request);
  if (!viewerId) {
    throw new ApiError(401, 'Invalid token');
  }
  const viewer = await prismaClient.viewer.findUnique({where: {id: viewerId}});
  if (!viewer) {
    throw new ApiError(401, 'Invalid token');
  }

  // A request body can arrive empty/unparseable (a queued message whose body
  // was lost in transit, a truncated mobile upload). We MUST NOT 500 here:
  // OwnTracks treats a 5xx as retriable and never dequeues the message, so it
  // resends the same broken body ~every second forever (see the reconnect loop
  // in Connection.m). Returning 2xx lets the app discard it and move on, and
  // there is nothing to persist from an empty body anyway.
  const raw = await request.text();
  let body: OwnTracksMessage | undefined;
  if (raw) {
    try {
      body = JSON.parse(raw) as OwnTracksMessage;
    } catch {
      body = undefined;
    }
  }

  if (body?._type === 'location') {
    await prismaClient.viewerLocation.create({
      data: {
        latitude: body.lat,
        longitude: body.lon,
        viewerId,
        createdAt: new Date(body.tst * 1000),
        payload: body,
      },
    });
  }

  // Reply with the recent locations of all *other* viewers (the OwnTracks
  // "friends" view). The requester is excluded: the app already shows its own
  // device under its own topic (owntracks/<user>/<device>), and echoing it back
  // would surface a duplicate friend re-topiced to owntracks/http/<tid>.
  const where = {createdAt: {gt: sub(new Date(), {hours: 5})}};
  const viewers = await prismaClient.viewer.findMany({
    where: {id: {not: viewerId}, ViewerLocation: {some: where}},
    include: {
      ViewerLocation: {where, orderBy: {createdAt: 'desc'}, take: 1},
    },
  });

  // Encode avatars in parallel (cached), keyed by viewer id, before the
  // synchronous message build below.
  const faces = new Map(
    await Promise.all(
      viewers.map(
        async (v) => [v.id, await avatarFace(v.profilePicture)] as const,
      ),
    ),
  );

  const messages = viewers.flatMap((v) => {
    const loc = v.ViewerLocation[0];
    const tst = Math.floor(loc.createdAt.getTime() / 1000);
    // OwnTracks derives a friend's identity from `tid` alone: any HTTP-received
    // message is filed under topic `owntracks/http/<tid>`, and the `topic` field
    // in the payload is ignored (Connection.m:588-596). Initials aren't unique
    // (two "DB"s would merge into one friend and overwrite each other), so use
    // the viewer id as the tid, and show the person on the map via the card
    // `face` (avatar) instead. The human-readable name comes from `name`.
    return [
      {_type: 'card', name: v.displayName, tid: v.id, face: faces.get(v.id) ?? ''},
      {
        _type: 'location',
        tid: v.id,
        lat: loc.latitude,
        lon: loc.longitude,
        tst,
        created_at: tst,
        topic: `owntracks/${v.id}`,
        bs: BatteryStatus.Unknown,
      },
    ];
  });

  return Response.json(messages);
}
