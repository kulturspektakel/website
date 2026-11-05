import {eq} from 'drizzle-orm';
import {db} from './db.server';
import {crewCard, type WalletPassFields} from './db/schema';
import {
  buildAppleWalletPass,
  isAppleWalletConfigured,
} from './appleWallet/pass.server';
import {refreshCrewCardPass} from './crewCardPass.server';
import {decodePayload, encodeCrewCardPayload} from '../utils/decodePayload';
import {
  byteArrayToString,
  kultEpochOfDate,
  stringToByteArray,
} from '../utils/cardUtils';
import {CrewCardType} from '../utils/enums';
import {isWithinWalletDownloadWindow} from '../utils/walletPass';

/** What a pass is built from, for `db.query.crewCard` queries. */
export const walletCardColumns = {
  id: true,
  cardType: true,
  suspended: true,
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
 * re-derived from the id and `validUntil`, so it's the card link's payload.
 */
export function buildCrewCardPass(
  card: {id: Uint8Array; validUntil: Date; walletAuthToken: string},
  fields: WalletPassFields,
): Buffer {
  const serialNumber = byteArrayToString(card.id);
  return buildAppleWalletPass({
    serialNumber,
    cardId: serialNumber.match(/.{2}/g)!.join(':'),
    authenticationToken: card.walletAuthToken,
    payload: encodeCrewCardPayload(card.id, kultEpochOfDate(card.validUntil)),
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
 * GET /api/crewcard/wallet/apple/<payload>: the Apple Wallet pass for a wallet
 * CrewCard, started by the card page when it's opened with `?wallet=apple`.
 *
 * Serves the pass only for an unsuspended APPLE_WALLET card in its first
 * minutes (`isWithinWalletDownloadWindow`); the page checks the same thing, but
 * only for convenience. Anything else redirects to the plain card page, so the
 * link quietly stays a card link. Safari shows a pass response as a sheet over
 * the page that requested it, so the user stays on the card page. Once
 * installed, the pass updates through the web service instead
 * (appleWalletWebService.ts), which has no such window.
 */
export async function handleAppleWalletPass(
  payload: string,
): Promise<Response> {
  const cardPage = new Response(null, {
    status: 302,
    headers: {Location: `/card/${payload}/crew`, 'Cache-Control': 'no-store'},
  });

  let cardId: string;
  try {
    ({cardId} = decodePayload('crewcard', payload));
  } catch {
    return cardPage;
  }
  if (!isAppleWalletConfigured()) {
    return cardPage;
  }

  const card = await db.query.crewCard.findFirst({
    where: eq(crewCard.id, Buffer.from(stringToByteArray(cardId))),
    columns: walletCardColumns,
  });
  if (
    card?.cardType !== CrewCardType.APPLE_WALLET ||
    card.suspended ||
    // Every wallet card gets one when `/crewcard` creates it.
    !card.walletAuthToken ||
    !isWithinWalletDownloadWindow(card.enrolledAt)
  ) {
    return cardPage;
  }

  // Creates the snapshot on the first download; the web service serves it
  // from then on.
  const fields = await refreshCrewCardPass(card.id);
  if (!fields) {
    return cardPage;
  }
  return passResponse(
    buildCrewCardPass({...card, walletAuthToken: card.walletAuthToken}, fields),
  );
}
