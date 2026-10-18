import {isPast, sub} from 'date-fns';
import {and, desc, eq, exists, gt, gte, isNotNull, lt} from 'drizzle-orm';
import {CardActivity} from '../components/kultcard/CardActivities';
import {db} from './db.server';
import {cardTransaction, crewCard, deviceLog, order} from './db/schema';

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

export async function queryCrewCard(
  cardId: Uint8Array<ArrayBuffer>,
  event: {start: Date; end: Date},
) {
  return db.query.crewCard.findFirst({
    where: eq(crewCard.id, Buffer.from(cardId)),
    columns: {privileged: true, suspended: true, nickname: true},
    with: {
      viewer: {columns: {displayName: true, profilePicture: true}},
      orders: {
        where: and(
          lt(order.createdAt, event.end),
          gt(order.createdAt, event.start),
        ),
        orderBy: desc(order.createdAt),
        columns: {id: true, createdAt: true, notForMe: true},
        with: {
          orderItems: {
            columns: {name: true, amount: true},
            with: {
              productList: {columns: {id: true, name: true, emoji: true}},
            },
          },
        },
      },
    },
  });
}

export function orderToCardActivity(
  orders: NonNullable<Awaited<ReturnType<typeof queryCrewCard>>>['orders'],
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
