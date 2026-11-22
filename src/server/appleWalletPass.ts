import {eq} from 'drizzle-orm';
import {db} from './db.server';
import {crewCard, type WalletPassFields} from './db/schema';
import {
  buildAppleWalletPass,
  isAppleWalletConfigured,
} from './appleWallet/pass.server';
import {refreshCrewCardPass} from './crewCardPass.server';
import {encodeCrewCardPayload} from '../utils/decodePayload';
import {
  byteArrayToString,
  formatSerial,
  kultEpochOfDate,
} from '../utils/cardUtils';
import {CrewCardType} from '../utils/enums';
import {verifyPassDownloadToken} from './crewCardPassToken.server';

/** What a pass is built from, for `db.query.crewCard` queries. */
export const walletCardColumns = {
  id: true,
  serial: true,
  cardType: true,
  suspendedAt: true,
  enrolledAt: true,
  validUntil: true,
  walletAuthToken: true,
  passUpdatedAt: true,
  walletPass: true,
} as const;

/** When the pass content last changed: `Last-Modified` and update tags. */
export function passLastModified(card: {
  passUpdatedAt: Date | null;
  enrolledAt: Date;
}): Date {
  return card.passUpdatedAt ?? card.enrolledAt;
}

/**
 * The card's pass: the card itself (serial, token, validity, NFC payload) plus
 * the `walletPass` snapshot (crewCardPass.server.ts). The NFC payload is
 * re-derived from the serial and `validUntil`, so it's the card link's payload.
 */
export function buildCrewCardPass(
  card: {serial: Uint8Array; validUntil: Date; walletAuthToken: string},
  fields: WalletPassFields,
): Buffer {
  const serialNumber = byteArrayToString(card.serial);
  return buildAppleWalletPass({
    serialNumber,
    cardId: formatSerial(serialNumber),
    authenticationToken: card.walletAuthToken,
    payload: encodeCrewCardPayload(
      card.serial,
      kultEpochOfDate(card.validUntil),
    ),
    validUntil: card.validUntil,
    fields,
  });
}

export function passResponse(pass: Buffer, headers: HeadersInit = {}) {
  return new Response(new Uint8Array(pass), {
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename="CrewCard.pkpass"',
      'Cache-Control': 'private, no-store',
      ...headers,
    },
  });
}

/**
 * GET /api/crewcard/wallet/apple/<token>: the Apple Wallet pass for a wallet
 * CrewCard, started by the holder page when it's opened with `?pass=<token>`
 * (the link `/crewcard` replies with). The token
 * (crewCardPassToken.server.ts) is valid for a few minutes.
 *
 * Serves the pass only for a valid token of a live APPLE_WALLET card.
 * Anything else redirects to the holder page (or the home page if the token
 * says nothing), so the link quietly stays a page link. Safari shows a pass
 * response as a sheet over the page that requested it, so the user stays on
 * the holder page. Once installed, the pass updates through the web service
 * instead (appleWalletWebService.ts), which needs no token.
 */
export async function handleAppleWalletPass(token: string): Promise<Response> {
  const redirectTo = (location: string) =>
    new Response(null, {
      status: 302,
      headers: {Location: location, 'Cache-Control': 'no-store'},
    });

  const cardId = verifyPassDownloadToken(token);
  if (!cardId) {
    return redirectTo('/');
  }
  const card = await db.query.crewCard.findFirst({
    where: eq(crewCard.id, cardId),
    columns: walletCardColumns,
    with: {holder: {columns: {pageToken: true}}},
  });
  if (!card) {
    return redirectTo('/');
  }
  const holderPage = redirectTo(`/crewcard/${card.holder.pageToken}`);
  if (
    !isAppleWalletConfigured() ||
    card.cardType !== CrewCardType.APPLE_WALLET ||
    card.suspendedAt ||
    // Every wallet card has one (a check constraint).
    !card.walletAuthToken
  ) {
    return holderPage;
  }

  // Creates the snapshot on the first download; the web service serves it
  // from then on.
  const fields = await refreshCrewCardPass(card.id);
  if (!fields) {
    return holderPage;
  }
  return passResponse(
    buildCrewCardPass({...card, walletAuthToken: card.walletAuthToken}, fields),
  );
}
