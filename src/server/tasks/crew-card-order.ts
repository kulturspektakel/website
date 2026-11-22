import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {order as orderTable} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {awardedBadges, queryHolder} from '../../server/cardUtils.server';
import {holderForOrder} from '../../server/crewCards.server';
import {badgeConfig, type BadgeKey} from '../../utils/badgeConfig';
import {getCurrentEvent} from '../../server/getCurrentEvent.server';
import {slackApiRequest} from '../../server/slack.server';
import {refreshHolderWalletPasses} from '../../server/crewCardPass.server';
import {formatCents} from '../../utils/currency';

/**
 * Triggered from `kultcash.ts` whenever a CrewCard order lands. Finds the card
 * the order belongs to (by its serial and time) and its holder, recomputes the
 * holder's badges (over all their cards) with the new order included, diffs
 * against the pre-order badges, and DMs them on Slack for each newly-awarded
 * one. The holder's live wallet pass gets the new totals and the order (with
 * any new badges) as its message, which Wallet shows as a notification, also
 * when the order was paid with their physical card.
 *
 * Orders of a chip nobody has been assigned yet have no holder: nothing to do.
 * They count once the chip is assigned.
 */
export async function handleCrewCardOrder(request: Request): Promise<Response> {
  const {orderId} = await readJsonPayload<{orderId: number}>(request);

  const [order, event] = await Promise.all([
    db.query.order.findFirst({
      where: eq(orderTable.id, orderId),
      columns: {crewCardSerial: true, createdAt: true},
      with: {
        orderItems: {
          columns: {amount: true, perUnitPrice: true},
          with: {productList: {columns: {name: true}}},
        },
      },
    }),
    getCurrentEvent(),
  ]);
  if (!order?.crewCardSerial) {
    return new Response(null, {status: 204});
  }
  const holderId = await holderForOrder(
    Buffer.from(order.crewCardSerial),
    order.createdAt,
  );
  if (!holderId) {
    return new Response(null, {status: 204});
  }

  const holder = await queryHolder({id: holderId}, event);
  if (!holder) {
    return new Response(null, {status: 204});
  }

  const oldBadges = awardedBadges(
    holder.orders.filter((o) => o.id !== orderId),
    event,
  );
  const newBadges = awardedBadges(holder.orders, event);

  const newlyAwarded = newBadges.filter((nb) =>
    oldBadges.every((ob) => ob.badgeKey !== nb.badgeKey),
  );

  // Never throws, so the DMs below aren't retried over it; and if they are,
  // the same message doesn't change the pass, so it isn't pushed again.
  await refreshHolderWalletPasses([holder.id], {
    message: orderMessage(
      order,
      newlyAwarded.map(({badgeKey}) => badgeKey),
    ),
  });

  // Viewer ids are Slack ids; nickname holders have no Slack to DM.
  const viewerSlackId = holder.viewerId;
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
