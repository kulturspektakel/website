import {isPast, sub} from 'date-fns';
import {
  and,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  type SQLWrapper,
} from 'drizzle-orm';
import {CardActivity} from '../components/kultcard/CardActivities';
import {db, type DbExecutor} from './db.server';
import {computeBadges} from '../utils/useBadges';
import {cardTransaction, crewCardHolder, deviceLog, order} from './db/schema';
import {enrollmentOrderIds, holderOrderIds} from './crewCards.server';

export async function queryCardTransactions(
  cardId: string,
  event: {start: Date; end: Date},
) {
  const since = isPast(event.end) ? event.start : sub(new Date(), {days: 7});
  return db.query.cardTransaction.findMany({
    columns: {
      balanceAfter: true,
      balanceBefore: true,
      depositAfter: true,
      depositBefore: true,
      counter: true,
      cardId: true,
      transactionType: true,
    },
    with: {
      order: {
        columns: {createdAt: true},
        with: {
          orderItems: {
            columns: {amount: true, name: true},
            with: {productList: {columns: {name: true, emoji: true}}},
          },
        },
      },
      deviceLog: {columns: {deviceTime: true}},
    },
    // The callback's table is the query's own alias, which the subquery has to
    // refer to.
    where: (t) =>
      and(
        eq(t.cardId, cardId),
        isNotNull(t.counter),
        exists(
          db
            .select({clientId: deviceLog.clientId})
            .from(deviceLog)
            .where(
              and(
                eq(deviceLog.clientId, t.clientId),
                gte(deviceLog.deviceTime, since),
              ),
            ),
        ),
      ),
    orderBy: desc(cardTransaction.counter),
  });
}

/** Orders (with items) among `ids` placed during the event, newest first. */
function eventOrders(
  ids: SQLWrapper,
  event: {start: Date; end: Date},
  executor: DbExecutor,
) {
  return executor.query.order.findMany({
    orderBy: desc(order.createdAt),
    columns: {id: true, createdAt: true, notForMe: true},
    with: {
      orderItems: {
        columns: {name: true, amount: true, perUnitPrice: true},
        with: {
          productList: {columns: {id: true, name: true, emoji: true}},
        },
      },
    },
    where: and(
      inArray(order.id, ids),
      lt(order.createdAt, event.end),
      gt(order.createdAt, event.start),
    ),
  });
}

/**
 * A CrewCard holder (by id, or by the holder page's token) with their orders
 * at the event: the orders of all their cards, old and suspended ones included
 * (see `holderOrderIds`).
 */
export async function queryHolder(
  by: {id: string} | {pageToken: string},
  event: {start: Date; end: Date},
  executor: DbExecutor = db,
) {
  const holderQuery = executor.query.crewCardHolder.findFirst({
    where:
      'id' in by
        ? eq(crewCardHolder.id, by.id)
        : eq(crewCardHolder.pageToken, by.pageToken),
    columns: {id: true, viewerId: true, nickname: true, privileged: true},
    with: {
      viewer: {columns: {displayName: true, profilePicture: true}},
    },
  });
  const ordersOf = (holderId: string) =>
    eventOrders(holderOrderIds(holderId, executor), event, executor);

  if ('id' in by) {
    const [holder, orders] = await Promise.all([holderQuery, ordersOf(by.id)]);
    return holder && {...holder, orders};
  }
  const holder = await holderQuery;
  return holder && {...holder, orders: await ordersOf(holder.id)};
}

/**
 * The orders of an enrolled chip nobody has been assigned yet (since its
 * enrollment), for the anonymous card page.
 */
export function queryEnrollmentOrders(
  serial: Buffer,
  event: {start: Date; end: Date},
) {
  return eventOrders(enrollmentOrderIds(serial), event, db);
}

/** How a holder is called: their Slack name or nickname. */
export function holderName(holder: {
  viewer: {displayName: string} | null;
  nickname: string | null;
}): string {
  return holder.viewer?.displayName ?? holder.nickname ?? 'Crew';
}

type CrewCardOrders = Awaited<ReturnType<typeof queryEnrollmentOrders>>;

/** What was booked in the orders, in cents. */
export function bookingsTotal(orders: CrewCardOrders): number {
  return orders.reduce(
    (sum, o) =>
      sum +
      o.orderItems.reduce((n, item) => n + item.amount * item.perUnitPrice, 0),
    0,
  );
}

/** The card page's "Buchungen": items booked, over all of the orders. */
export function bookedItems(orders: CrewCardOrders): number {
  return orders.reduce(
    (sum, o) => sum + o.orderItems.reduce((n, item) => n + item.amount, 0),
    0,
  );
}

/** A CrewCard's awarded badges (orders marked "nicht für mich" don't count). */
export function awardedBadges(
  orders: CrewCardOrders,
  event: {start: Date; end: Date},
) {
  return computeBadges(orderToCardActivity(orders), event, true).filter(
    (badge) => badge.status === 'awarded',
  );
}

export function orderToCardActivity(
  orders: CrewCardOrders,
): Array<CardActivity> {
  return orders.map((o) => ({
    type: 'order' as const,
    orderId: o.id,
    notForMe: o.notForMe,
    productList: o.orderItems[0].productList?.name!,
    emoji: o.orderItems[0].productList?.emoji ?? null,
    items: o.orderItems,
    time: o.createdAt,
  }));
}
