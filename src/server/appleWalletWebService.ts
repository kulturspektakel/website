import {timingSafeEqual} from 'crypto';
import * as Sentry from '@sentry/tanstackstart-react';
import {and, eq} from 'drizzle-orm';
import {db} from './db.server';
import {crewCard, walletPassRegistration} from './db/schema';
import {isAppleWalletConfigured} from './appleWallet/pass.server';
import {CREW_PASS} from './appleWallet/passType';
import {
  buildCrewCardPass,
  passLastModified,
  passResponse,
  walletCardColumns,
  walletCardWith,
} from './appleWalletPass';
import {byteArrayToString, stringToByteArray} from '../utils/cardUtils';
import {CrewCardType} from '../utils/enums';

/**
 * The PassKit web service for wallet CrewCard passes: everything under the
 * pass's `webServiceURL` (WALLET_WEB_SERVICE_URL), `path` being the part after
 * `…/v1/`. Apple fixes the paths, methods and status codes:
 * https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
 *
 *   POST   devices/<device>/registrations/<passType>/<serial>  register
 *   DELETE devices/<device>/registrations/<passType>/<serial>  unregister
 *   GET    devices/<device>/registrations/<passType>           changed serials
 *   GET    passes/<passType>/<serial>                          current pass
 *   POST   log                                                 Wallet's errors
 *
 * Requests about one pass carry `Authorization: ApplePass <token>`, the card's
 * `walletAuthToken`; a wrong token and an unknown serial both get 401. The
 * changed-serials request has no token: it only reveals serials the device
 * registered itself.
 *
 * Nothing pushes updates yet: `passUpdatedAt` stays null, so the passes don't
 * change, but Wallet's pull-to-refresh already gets the current pass.
 */
export async function handleAppleWalletWebService(
  request: Request,
  path: string,
): Promise<Response> {
  const segments = path.split('/');
  const method = request.method;

  if (segments[0] === 'devices' && segments[2] === 'registrations') {
    const [, deviceId, , passTypeId, serial] = segments;
    if (!isDeviceId(deviceId) || passTypeId !== CREW_PASS.passTypeIdentifier) {
      return notFound();
    }
    if (segments.length === 5 && method === 'POST') {
      return register(request, deviceId, serial);
    }
    if (segments.length === 5 && method === 'DELETE') {
      return unregister(request, deviceId, serial);
    }
    if (segments.length === 4 && method === 'GET') {
      return updatedSerials(request, deviceId);
    }
  }

  if (segments[0] === 'passes' && segments.length === 3 && method === 'GET') {
    const [, passTypeId, serial] = segments;
    if (passTypeId !== CREW_PASS.passTypeIdentifier) {
      return notFound();
    }
    return latestPass(request, serial);
  }

  if (path === 'log' && method === 'POST') {
    return log(request);
  }

  return notFound();
}

const notFound = () => new Response(null, {status: 404});
const unauthorized = () => new Response(null, {status: 401});

// Apple doesn't specify the format (in practice 32 hex characters); anything
// sane goes, so a format change doesn't break registrations.
const isDeviceId = (id: string | undefined): id is string =>
  Boolean(id && /^[\w.-]{1,128}$/.test(id));

// The card id as plain uppercase hex, as `crewPassJson` sets it.
const SERIAL = /^[0-9A-F]{14}$/;

/** The wallet card a pass request is about, if its token is right. */
async function authorizedCard(request: Request, serial: string | undefined) {
  const token = request.headers
    .get('Authorization')
    ?.match(/^ApplePass (\S+)$/)?.[1];
  if (!token || !serial || !SERIAL.test(serial)) {
    return undefined;
  }
  const card = await db.query.crewCard.findFirst({
    where: and(
      eq(crewCard.id, Buffer.from(stringToByteArray(serial))),
      eq(crewCard.cardType, CrewCardType.APPLE_WALLET),
    ),
    columns: walletCardColumns,
    with: walletCardWith,
  });
  if (!card?.walletAuthToken || !tokensMatch(card.walletAuthToken, token)) {
    return undefined;
  }
  return {...card, walletAuthToken: card.walletAuthToken};
}

function tokensMatch(expected: string, given: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function register(
  request: Request,
  deviceId: string,
  serial: string | undefined,
) {
  const card = await authorizedCard(request, serial);
  if (!card) {
    return unauthorized();
  }
  const body: unknown = await request.json().catch(() => undefined);
  const pushToken =
    body && typeof body === 'object' && 'pushToken' in body
      ? body.pushToken
      : undefined;
  if (typeof pushToken !== 'string' || !pushToken) {
    return new Response(null, {status: 400});
  }

  const created = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(walletPassRegistration)
      .values({
        deviceLibraryIdentifier: deviceId,
        crewCardId: card.id,
        pushToken,
      })
      .onConflictDoNothing()
      .returning({crewCardId: walletPassRegistration.crewCardId});
    // The token is the device's: a new one applies to all its passes.
    await tx
      .update(walletPassRegistration)
      .set({pushToken})
      .where(eq(walletPassRegistration.deviceLibraryIdentifier, deviceId));
    return inserted.length > 0;
  });
  // 201 for a new registration, 200 if the device had the pass already.
  return new Response(null, {status: created ? 201 : 200});
}

async function unregister(
  request: Request,
  deviceId: string,
  serial: string | undefined,
) {
  const card = await authorizedCard(request, serial);
  if (!card) {
    return unauthorized();
  }
  await db
    .delete(walletPassRegistration)
    .where(
      and(
        eq(walletPassRegistration.deviceLibraryIdentifier, deviceId),
        eq(walletPassRegistration.crewCardId, card.id),
      ),
    );
  return new Response(null, {status: 200});
}

/**
 * The device's passes changed since `passesUpdatedSince`, a tag from an
 * earlier answer's `lastUpdated` (epoch ms here; Wallet treats it as opaque).
 * Without a tag, all of them. 204 if there are none.
 */
async function updatedSerials(request: Request, deviceId: string) {
  const since = Number(
    new URL(request.url).searchParams.get('passesUpdatedSince') ?? '',
  );
  const registrations = await db.query.walletPassRegistration.findMany({
    where: eq(walletPassRegistration.deviceLibraryIdentifier, deviceId),
    // The id from the registration itself: a bytea nested in a relational
    // query arrives as `\x…` text, not a Buffer.
    columns: {crewCardId: true},
    with: {crewCard: {columns: {passUpdatedAt: true, enrolledAt: true}}},
  });

  const updated = registrations
    .map(({crewCardId, crewCard}) => ({
      serial: byteArrayToString(crewCardId),
      modified: passLastModified(crewCard).getTime(),
    }))
    .filter(({modified}) => !Number.isFinite(since) || modified > since);
  if (updated.length === 0) {
    return new Response(null, {status: 204});
  }
  return Response.json({
    serialNumbers: updated.map(({serial}) => serial),
    lastUpdated: String(Math.max(...updated.map(({modified}) => modified))),
  });
}

/**
 * The current pass. Suspended cards get theirs unchanged for now (voiding
 * comes with pushing updates). 304 when `If-Modified-Since` is current;
 * HTTP dates only have seconds, so the comparison is too.
 */
async function latestPass(request: Request, serial: string | undefined) {
  const card = await authorizedCard(request, serial);
  if (!card) {
    return unauthorized();
  }
  if (!isAppleWalletConfigured()) {
    return new Response(null, {status: 503});
  }

  const modified = passLastModified(card);
  const lastModified = modified.toUTCString();
  const ifModifiedSince = Date.parse(
    request.headers.get('If-Modified-Since') ?? '',
  );
  if (
    Number.isFinite(ifModifiedSince) &&
    Math.floor(modified.getTime() / 1000) * 1000 <= ifModifiedSince
  ) {
    return new Response(null, {
      status: 304,
      headers: {'Last-Modified': lastModified, 'Cache-Control': 'no-store'},
    });
  }

  return passResponse(buildCrewCardPass(card), {'Last-Modified': lastModified});
}

// Unauthenticated, so capped: Wallet only sends a few lines at a time.
const MAX_LOG_LINES = 20;
const MAX_LOG_LINE_LENGTH = 1000;

/**
 * Wallet reports what went wrong with a pass here: the only place it says why
 * a registration or update failed. Goes to Sentry as a warning.
 */
async function log(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const logs =
    body && typeof body === 'object' && 'logs' in body ? body.logs : undefined;
  if (!Array.isArray(logs)) {
    return new Response(null, {status: 400});
  }
  const lines = logs
    .slice(0, MAX_LOG_LINES)
    .map((line) => String(line).slice(0, MAX_LOG_LINE_LENGTH));
  console.warn('[wallet] Apple Wallet log', lines);
  Sentry.captureMessage('Apple Wallet log', {
    level: 'warning',
    extra: {logs: lines},
  });
  return new Response(null, {status: 200});
}
