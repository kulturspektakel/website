import {sub} from 'date-fns';
import {prismaClient} from '../../utils/prismaClient.server';
import {ApiError} from '../../utils/apiError.server';
import {ownTracksPassword} from '../../utils/ownTracksPassword.server';

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
    url: `${process.env.SITE_URL}/owntracks`,
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

export async function handleOwnTracks(request: Request): Promise<Response> {
  const viewerId = viewerIdFromBasicAuth(request);
  if (!viewerId) {
    throw new ApiError(401, 'Invalid token');
  }
  const viewer = await prismaClient.viewer.findUnique({where: {id: viewerId}});
  if (!viewer) {
    throw new ApiError(401, 'Invalid token');
  }

  const body = (await request.json()) as OwnTracksMessage;

  if (body._type === 'location') {
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

  // Reply with the recent locations of all viewers (the OwnTracks "friends" view).
  const where = {createdAt: {gt: sub(new Date(), {hours: 5})}};
  const viewers = await prismaClient.viewer.findMany({
    where: {ViewerLocation: {some: where}},
    include: {
      ViewerLocation: {where, orderBy: {createdAt: 'desc'}, take: 1},
    },
  });

  const messages = viewers.flatMap((v) => {
    const loc = v.ViewerLocation[0];
    const tst = Math.floor(loc.createdAt.getTime() / 1000);
    return [
      {_type: 'card', name: v.displayName, tid: tid(v), face: ''},
      {
        _type: 'location',
        tid: tid(v),
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
