import {CardActivity} from '../components/kultcard/CardActivities';
import {prismaClient} from './prismaClient.server';

export async function queryCardTransactions(
  cardId: string,
  event: {start: Date; end: Date},
) {
  return prismaClient.cardTransaction.findMany({
    select: {
      balanceAfter: true,
      balanceBefore: true,
      depositAfter: true,
      depositBefore: true,
      counter: true,
      cardId: true,
      transactionType: true,
      Order: {
        select: {
          createdAt: true,
          items: {
            select: {
              amount: true,
              name: true,
              productList: {
                select: {
                  name: true,
                  emoji: true,
                },
              },
            },
          },
        },
      },
      deviceLog: {
        select: {
          deviceTime: true,
        },
      },
    },
    where: {
      cardId,
      deviceLog: {
        deviceTime: {
          gte: new Date('2025-07-20'), //isPast(event.end) ? event.start : sub(new Date(), {days: 7}),
        },
      },
      counter: {
        not: null,
      },
    },
    orderBy: {
      counter: 'desc',
    },
  });
}

export function queryCrewCard(
  cardId: Uint8Array<ArrayBuffer>,
  event: {start: Date; end: Date},
) {
  return prismaClient.crewCard.findUnique({
    where: {
      id: cardId,
    },
    select: {
      privileged: true,
      suspended: true,
      nickname: true,
      viewer: {
        select: {
          displayName: true,
          profilePicture: true,
        },
      },
      Order: {
        where: {
          createdAt: {
            lt: event.end,
            gt: event.start,
          },
        },
        select: {
          id: true,
          createdAt: true,
          items: {
            select: {
              name: true,
              amount: true,
              productList: {
                select: {
                  id: true,
                  name: true,
                  emoji: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
}

export function orderToCardActivity(
  order: NonNullable<Awaited<ReturnType<typeof queryCrewCard>>>['Order'],
): Array<CardActivity> {
  return order.map((o) => ({
    type: 'order' as const,
    productList: o.items[0].productList?.name!,
    emoji: o.items[0].productList?.emoji ?? null,
    items: o.items,
    time: o.createdAt,
  }));
}
