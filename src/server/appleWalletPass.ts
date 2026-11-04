import {subDays} from 'date-fns';
import {eq} from 'drizzle-orm';
import {db} from './db.server';
import {crewCard} from './db/schema';
import {
  buildAppleWalletPass,
  isAppleWalletConfigured,
} from './appleWallet/pass.server';
import {decodePayload, encodeCrewCardPayload} from '../utils/decodePayload';
import {
  byteArrayToString,
  kultEpochOfDate,
  stringToByteArray,
} from '../utils/cardUtils';
import {CrewCardType} from '../utils/enums';
import {isWithinWalletDownloadWindow} from '../utils/walletPass';
import {locale, timeZone} from '../utils/dateUtils';

/** What a pass is built from, for `db.query.crewCard` queries. */
export const walletCardColumns = {
  id: true,
  cardType: true,
  suspended: true,
  enrolledAt: true,
  validUntil: true,
  nickname: true,
  privileged: true,
  walletAuthToken: true,
  passUpdatedAt: true,
  walletMessage: true,
} as const;
export const walletCardWith = {
  viewer: {columns: {displayName: true}},
} as const;

type WalletCard = {
  id: Uint8Array;
  validUntil: Date;
  nickname: string | null;
  privileged: boolean;
  walletAuthToken: string;
  walletMessage: string | null;
  viewer: {displayName: string} | null;
};

/** When the pass content last changed: `Last-Modified` and update tags. */
export function passLastModified(card: {
  passUpdatedAt: Date | null;
  enrolledAt: Date;
}): Date {
  return card.passUpdatedAt ?? card.enrolledAt;
}

/**
 * The card's current pass, built from the database alone (the download route
 * and the web service serve the same thing). The NFC payload is re-derived
 * from the id and `validUntil`, so it's the card link's payload.
 */
export function buildCrewCardPass(card: WalletCard): Buffer {
  const serialNumber = byteArrayToString(card.id);
  return buildAppleWalletPass({
    serialNumber,
    cardId: serialNumber.match(/.{2}/g)!.join(':'),
    authenticationToken: card.walletAuthToken,
    payload: encodeCrewCardPayload(card.id, kultEpochOfDate(card.validUntil)),
    // The Slack name, refreshed from Slack whenever `/crewcard` runs.
    holderName: card.viewer?.displayName ?? card.nickname ?? 'Crew',
    lastValidDay: subDays(card.validUntil, 1).toLocaleDateString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    }),
    validUntil: card.validUntil,
    privileged: card.privileged,
    message: card.walletMessage,
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
    with: walletCardWith,
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

  return passResponse(
    buildCrewCardPass({...card, walletAuthToken: card.walletAuthToken}),
  );
}
