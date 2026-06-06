import {createHash} from 'node:crypto';
import {createMiddleware} from '@tanstack/react-start';
import {prismaClient} from './prismaClient.server';
import type {DeviceType} from '../generated/prisma/client';

/**
 * Identity attached to an authenticated `/api/*` request.
 *
 * This is the shared auth primitive for all API routes — `parseToken` inspects
 * the incoming `Request` and returns the matching token, or `undefined` when
 * the request is unauthenticated. New issuers (e.g. a JWT-based `directus`
 * token) can be added as additional members of this union and a corresponding
 * branch in `parseToken`.
 */
export type ParsedToken =
  | {
      iss: 'device';
      deviceId: string;
    }
  | {
      iss: 'gcp';
      email: string;
      audience: string;
    };

export type DeviceToken = Extract<ParsedToken, {iss: 'device'}>;
export type GcpToken = Extract<ParsedToken, {iss: 'gcp'}>;

const sha1 = (data: string) => createHash('sha1').update(data).digest('hex');

// User-agent prefixes used by our firmware to identify HTTP Basic auth as
// coming from a device (vs. another Basic-auth client). The version suffix
// after the `/` is recorded as the device's `softwareVersion`.
const DEVICE_USER_AGENT_PREFIXES = ['Contactless/', 'NoiseMonitor/'];

function parseBasicAuth(
  header: string | null,
): {name: string; pass: string} | null {
  const match = header?.match(/^Basic (.+)$/i);
  if (!match) {
    return null;
  }
  const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
  const sep = decoded.indexOf(':');
  if (sep < 0) {
    return null;
  }
  return {name: decoded.slice(0, sep), pass: decoded.slice(sep + 1)};
}

/**
 * Resolve the authenticated identity for a request, or `undefined`.
 *
 * Devices authenticate via HTTP Basic auth with a product user-agent (e.g.
 * `Contactless/`, `NoiseMonitor/`) and a `sha1(deviceId + CONTACTLESS_SALT)`
 * password.
 */
export async function parseToken(
  request: Request,
): Promise<ParsedToken | undefined> {
  const salt = process.env.CONTACTLESS_SALT;
  if (!salt) {
    return undefined;
  }

  const headers = request.headers;
  const basicUser = parseBasicAuth(headers.get('authorization'));
  const userAgent = headers.get('user-agent') ?? '';

  if (
    // Device (contactless terminal or noise monitor): HTTP Basic auth with a
    // product user-agent and a `sha1(deviceId + salt)` password.
    basicUser &&
    DEVICE_USER_AGENT_PREFIXES.some((prefix) => userAgent.startsWith(prefix)) &&
    basicUser.pass === sha1(basicUser.name + salt)
  ) {
    return {iss: 'device', deviceId: basicUser.name};
  }

  return undefined;
}

function getSoftwareVersion(request: Request): string | undefined {
  return request.headers.get('user-agent')?.split('/').pop() || undefined;
}

/**
 * Records that a device is online: bumps `lastSeen` (and `softwareVersion` from
 * the request headers), creating the device with the given `type` if it's the
 * first time we see it. The `type` is only applied on creation, so a device's
 * kind is fixed at registration.
 */
async function touchDevice(
  request: Request,
  deviceId: string,
  type: DeviceType,
) {
  const lastSeen = new Date();
  const softwareVersion = getSoftwareVersion(request);
  await prismaClient.device.upsert({
    where: {id: deviceId},
    create: {id: deviceId, lastSeen, softwareVersion, type},
    update: {lastSeen, softwareVersion},
  });
}

/**
 * Request middleware that requires a valid device token, returning `401`
 * otherwise. On success it touches the device (updates `lastSeen` /
 * `softwareVersion`, registering it on first contact) and exposes the token to
 * handlers as `context.device`.
 *
 * It's a factory: pass the `type` the endpoint expects its devices to be (only
 * applied when the device is first created; defaults to a contactless
 * terminal), e.g. `deviceAuth('NOISE_MONITOR')`.
 */
export const deviceAuth = (type: DeviceType = 'CONTACTLESS_TERMINAL') =>
  createMiddleware({type: 'request'}).server(async ({request, next}) => {
    const token = await parseToken(request);
    if (token?.iss !== 'device') {
      return new Response('Unauthorized', {status: 401});
    }
    await touchDevice(request, token.deviceId, type);
    return next({context: {device: token}});
  });
