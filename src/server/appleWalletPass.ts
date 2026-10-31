import {subDays} from 'date-fns';
import {eq} from 'drizzle-orm';
import {db} from './db.server';
import {crewCard} from './db/schema';
import {
  buildAppleWalletPass,
  isAppleWalletConfigured,
} from './appleWallet/pass.server';
import {decodePayload} from '../utils/decodePayload';
import {stringToByteArray} from '../utils/cardUtils';
import {CrewCardType} from '../utils/enums';
import {isWithinWalletDownloadWindow} from '../utils/walletPass';
import {locale, timeZone} from '../utils/dateUtils';

/**
 * GET /api/crewcard/wallet/apple/<payload>: the Apple Wallet pass for a wallet
 * CrewCard, started by the card page when it's opened with `?wallet=apple`.
 *
 * Serves the pass only for an unsuspended APPLE_WALLET card in its first
 * minutes (`isWithinWalletDownloadWindow`); the page checks the same thing, but
 * only for convenience. Anything else redirects to the plain card page, so the
 * link quietly stays a card link. Safari shows a pass response as a sheet over
 * the page that requested it, so the user stays on the card page.
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
    columns: {
      cardType: true,
      suspended: true,
      enrolledAt: true,
      validUntil: true,
      nickname: true,
    },
    with: {viewer: {columns: {displayName: true}}},
  });
  if (
    card?.cardType !== CrewCardType.APPLE_WALLET ||
    card.suspended ||
    !isWithinWalletDownloadWindow(card.enrolledAt)
  ) {
    return cardPage;
  }

  const pass = buildAppleWalletPass({
    payload,
    cardId: cardId.match(/.{2}/g)!.join(':'),
    // The Slack name: `/crewcard` refreshed the Viewer from Slack moments ago.
    holderName: card.viewer?.displayName ?? card.nickname ?? 'Crew',
    lastValidDay: subDays(card.validUntil, 1).toLocaleDateString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    }),
    validUntil: card.validUntil,
  });

  return new Response(new Uint8Array(pass), {
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename="CrewCard.pkpass"',
      'Cache-Control': 'private, no-store',
    },
  });
}
