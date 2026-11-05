import {isDeepStrictEqual} from 'node:util';
import * as Sentry from '@sentry/tanstackstart-react';
import {and, eq, gte, inArray, sql} from 'drizzle-orm';
import {db} from './db.server';
import {
  crewCard,
  event,
  order,
  orderItem,
  type WalletPassFields,
} from './db/schema';
import {awardedBadges, queryCrewCard} from './cardUtils.server';
import {nextKulturspektakel} from './crewCards.server';
import {pushToCrewCardDevices} from './appleWallet/push.server';
import {CrewCardType} from '../utils/enums';

/**
 * A wallet CrewCard's pass content lives as a snapshot in `CrewCard.walletPass`
 * and passes are always built from it, so a pass changes only here: recompute
 * the fields from the database, and if they differ from the snapshot, store
 * them, bump `passUpdatedAt` and push to the card's devices. Anything that may
 * change what a pass shows (an order, "nicht für mich", the Bonbude
 * privilege) calls this; when nothing changed it's a no-op, which also keeps
 * Wallet from seeing an "update" that returns the same pass.
 */

/**
 * Brings the card's pass snapshot up to date and pushes if it changed.
 * `message` replaces the pass's message, the one field that notifies (the
 * template's `changeMessage`); without it the stored one is kept. Returns the
 * fields, or undefined for anything that isn't a wallet card. Throws on
 * failure; see `refreshWalletPasses` for callers that mustn't fail.
 */
export async function refreshCrewCardPass(
  cardId: Buffer,
  {message}: {message?: string} = {},
): Promise<WalletPassFields | undefined> {
  // The row lock serializes concurrent refreshes of a card (e.g. two orders
  // landing at once), so the last snapshot written includes everything. All
  // reads go through the transaction, so it holds just one connection.
  const result = await db.transaction(async (tx) => {
    const [card] = await tx
      .select({
        cardType: crewCard.cardType,
        enrolledAt: crewCard.enrolledAt,
        walletPass: crewCard.walletPass,
      })
      .from(crewCard)
      .where(eq(crewCard.id, cardId))
      .for('update');
    if (card?.cardType !== CrewCardType.APPLE_WALLET) {
      return undefined;
    }

    // A pass stays with the festival it started with: the one the card's
    // validity was derived from when `/crewcard` issued it.
    const passEvent = card.walletPass
      ? await tx.query.event.findFirst({
          where: eq(event.id, card.walletPass.eventId),
          columns: {id: true, start: true, end: true},
        })
      : await nextKulturspektakel(card.enrolledAt, tx);
    const current =
      passEvent && (await queryCrewCard(new Uint8Array(cardId), passEvent, tx));
    if (!passEvent || !current) {
      throw new Error('No Kulturspektakel for this card');
    }
    // Everything booked on the card since it was issued (with its pass), not
    // just at the festival like the badges.
    const [{bookingsTotal}] = await tx
      .select({
        bookingsTotal: sql<number>`coalesce(sum(${orderItem.amount} * ${orderItem.perUnitPrice}), 0)::int`,
      })
      .from(order)
      .innerJoin(orderItem, eq(orderItem.orderId, order.id))
      .where(
        and(
          eq(order.crewCardId, cardId),
          gte(order.createdAt, card.enrolledAt),
        ),
      );

    const fields: WalletPassFields = {
      eventId: passEvent.id,
      holderName: current.viewer?.displayName ?? current.nickname ?? 'Crew',
      privileged: current.privileged,
      bookingsTotal,
      badges: awardedBadges(current.orders, passEvent).length,
      message: message ?? card.walletPass?.message ?? null,
    };
    if (card.walletPass && isDeepStrictEqual(card.walletPass, fields)) {
      return {fields, changed: false};
    }
    await tx
      .update(crewCard)
      .set({walletPass: fields, passUpdatedAt: new Date()})
      .where(eq(crewCard.id, cardId));
    return {fields, changed: true};
  });

  // After the commit, so the devices fetch the new snapshot.
  if (result?.changed) {
    await pushToCrewCardDevices(cardId);
  }
  return result?.fields;
}

/**
 * `refreshCrewCardPass` for side effects of other actions (an order, a
 * privilege change): takes any cards, refreshes the wallet ones, and never
 * throws, so a Wallet problem doesn't fail (and retry) what triggered it.
 * Failures go to Sentry.
 */
export async function refreshWalletPasses(
  cardIds: Buffer[],
  options: {message?: string} = {},
): Promise<void> {
  if (cardIds.length === 0) {
    return;
  }
  const walletCards = await db
    .select({id: crewCard.id})
    .from(crewCard)
    .where(
      and(
        inArray(crewCard.id, cardIds),
        eq(crewCard.cardType, CrewCardType.APPLE_WALLET),
      ),
    )
    .catch(reportRefreshFailure([]));
  for (const {id} of walletCards) {
    await refreshCrewCardPass(id, options).catch(
      reportRefreshFailure(undefined),
    );
  }
}

const reportRefreshFailure =
  <T>(fallback: T) =>
  (e: unknown): T => {
    console.error('[wallet] pass refresh failed', e);
    Sentry.captureException(e);
    return fallback;
  };
