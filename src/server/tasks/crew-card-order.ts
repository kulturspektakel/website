import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {order as orderTable} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {awardedBadges, queryCrewCard} from '../../server/cardUtils.server';
import {badgeConfig, type BadgeKey} from '../../utils/badgeConfig';
import {getCurrentEvent} from '../../server/getCurrentEvent.server';
import {slackApiRequest} from '../../server/slack.server';
import {refreshWalletPasses} from '../../server/crewCardPass.server';
import {formatCents} from '../../utils/currency';

/**
 * Triggered from `kultcash.ts` whenever a CrewCard order lands. Recomputes
 * the cardholder's badges with the new order included, diffs against the
 * pre-order badges, and DMs them on Slack for each newly-awarded one. A wallet
 * card's pass gets the new totals and the order (with any new badges) as its
 * message, which Wallet shows as a notification.
 *
 * Previously this task lived in `~/api.kulturspektakel.de/src/tasks/badgeAwarded.ts`
 * and called back into this codebase via `/api/badges` to compute the diff —
 * now both sides live here, so that round-trip endpoint is gone.
 */
export async function handleCrewCardOrder(request: Request): Promise<Response> {
  const {orderId} = await readJsonPayload<{orderId: number}>(request);

  // The cardholder's Slack id is the card's `viewerId` (Viewer ids are Slack
  // ids); a card nobody claimed yet has none.
  const order = await db.query.order.findFirst({
    where: eq(orderTable.id, orderId),
    columns: {crewCardId: true},
    with: {
      crewCard: {columns: {viewerId: true}},
      orderItems: {
        columns: {amount: true, perUnitPrice: true},
        with: {productList: {columns: {name: true}}},
      },
    },
  });
  if (!order?.crewCardId) {
    return new Response(null, {status: 204});
  }

  const event = await getCurrentEvent();
  const crewCard = await queryCrewCard(new Uint8Array(order.crewCardId), event);
  if (!crewCard) {
    return new Response(null, {status: 204});
  }

  const oldBadges = awardedBadges(
    crewCard.orders.filter((o) => o.id !== orderId),
    event,
  );
  const newBadges = awardedBadges(crewCard.orders, event);

  const newlyAwarded = newBadges.filter((nb) =>
    oldBadges.every((ob) => ob.badgeKey !== nb.badgeKey),
  );

  // Never throws, so the DMs below aren't retried over it; and if they are,
  // the same message doesn't change the pass, so it isn't pushed again.
  await refreshWalletPasses([order.crewCardId], {
    message: orderMessage(
      order,
      newlyAwarded.map(({badgeKey}) => badgeKey),
    ),
  });

  const viewerSlackId = order.crewCard?.viewerId;
  if (!viewerSlackId) {
    return new Response(null, {status: 204});
  }
  await Promise.all(
    newlyAwarded.map((badge) =>
      slackApiRequest('chat.postMessage', {
        channel: viewerSlackId,
        text: `🎖️ Gratulation, du hast den ${badgeConfig[badge.badgeKey].name} Badge erhalten! Scanne deine CrewCard mit deinem Handy um deinen Badge zu sehen.`,
      }),
    ),
  );

  return new Response(null, {status: 204});
}

/**
 * The pass message for an order, e.g. "3,50€ (Ausschank), neuer Badge: Early
 * Bird" (or ", 2 neue Badges"). Wallet only notifies when the value changes,
 * so the same order twice in a row notifies once.
 */
export function orderMessage(
  order: {
    orderItems: Array<{
      amount: number;
      perUnitPrice: number;
      productList: {name: string} | null;
    }>;
  },
  newBadges: BadgeKey[],
): string {
  const total = order.orderItems.reduce(
    (sum, item) => sum + item.amount * item.perUnitPrice,
    0,
  );
  const list = order.orderItems[0]?.productList?.name;
  // "3,50€": without the (no-break) space Intl puts before the €.
  let message = `${formatCents(total).replace(/\s/g, '')}${list ? ` (${list})` : ''}`;
  if (newBadges.length === 1) {
    message += `, neuer Badge: ${badgeConfig[newBadges[0]].name}`;
  } else if (newBadges.length > 1) {
    message += `, ${newBadges.length} neue Badges`;
  }
  return message;
}
