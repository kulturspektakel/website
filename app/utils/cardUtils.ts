import {addDays, isPast, sub} from 'date-fns';
import {CardActivity} from '../components/kultcard/CardActivities';
import {prismaClient} from './prismaClient';
import {badgeConfig} from './badgeConfig';

export function byteArrayToString(bytes: Uint8Array) {
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function stringToByteArray(str: string) {
  return new Uint8Array(str.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

// TODO: should be shared with api.kulturspektakel.de
const START_OF_EPOCH = new Date(2025, 0, 2, 4);
export function kultEpochToDate(epoch: number): Date {
  return addDays(START_OF_EPOCH, epoch);
}

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
          OrderItem: {
            select: {
              amount: true,
              name: true,
              ProductList: {
                select: {
                  name: true,
                  emoji: true,
                },
              },
            },
          },
        },
      },
      DeviceLog: {
        select: {
          deviceTime: true,
        },
      },
    },
    where: {
      cardId,
      DeviceLog: {
        deviceTime: {
          gte: isPast(event.end) ? event.start : sub(new Date(), {days: 7}),
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
      Viewer: {
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
          OrderItem: {
            select: {
              name: true,
              amount: true,
              ProductList: {
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
    productList: o.OrderItem[0].ProductList?.name!,
    emoji: o.OrderItem[0].ProductList?.emoji ?? null,
    items: o.OrderItem,
    time: o.createdAt,
  }));
}

export function transformCardAvtivities(
  transactions: Awaited<ReturnType<typeof queryCardTransactions>>,
  counter: number,
  balance: number,
  deposit: number,
): Array<CardActivity> {
  // remove eveything after the current counter value
  const firstTransactionIndex = transactions.findIndex(
    (t) => t.counter! <= counter,
  );
  if (firstTransactionIndex > 0) {
    transactions.splice(0, firstTransactionIndex + 1);
  }
  // remove everything before last cashout
  const cashout = transactions.findIndex(
    (t) => t.transactionType === 'Cashout',
  );
  if (cashout > -1) {
    transactions.length = cashout;
  }

  if (transactions.length === 0) {
    return [];
  }

  const cardActivities: Array<CardActivity> = [];
  let numberOfMissingTransactions = 0;
  for (
    let c = counter;
    c >= transactions[transactions.length - 1].counter!;
    c--
  ) {
    const transaction = transactions.find((t) => t.counter === c);
    if (transaction?.transactionType === 'Repair') {
      // don't count repairs as missing transactions
      continue;
    }
    if (!transaction) {
      numberOfMissingTransactions++;
      continue;
    }

    if (numberOfMissingTransactions > 0) {
      cardActivities.push({
        type: 'missing',
        numberOfMissingTransactions,
        balanceAfter: balance,
        depositAfter: deposit,
        balanceBefore: transaction.balanceAfter,
        depositBefore: transaction.depositAfter,
      });

      numberOfMissingTransactions = 0;
    }

    deposit = transaction.depositBefore;
    balance = transaction.balanceBefore;

    if (transaction.Order) {
      cardActivities.push({
        type: 'order',
        productList:
          transaction.Order.OrderItem?.[0].ProductList?.name ?? 'Unbekannt',
        emoji: transaction.Order.OrderItem?.[0].ProductList?.emoji ?? null,
        time: transaction.Order.createdAt,
        items: transaction.Order.OrderItem.map((oi) => ({
          amount: oi.amount,
          name: oi.name,
        })),
        cardChange: {
          balanceAfter: transaction.balanceAfter,
          balanceBefore: transaction.balanceBefore,
          depositAfter: transaction.depositAfter,
          depositBefore: transaction.depositBefore,
        },
      });
    } else if (
      transaction.transactionType === 'Charge' ||
      transaction.transactionType === 'TopUp'
    ) {
      cardActivities.push({
        type: 'generic',
        balanceAfter: transaction.balanceAfter,
        balanceBefore: transaction.balanceBefore,
        depositAfter: transaction.depositAfter,
        depositBefore: transaction.depositBefore,
        transactionType: transaction.transactionType,
        time: transaction.DeviceLog.deviceTime,
      });
    }
  }
  // numberOfMissingTransactions might be > 0, but we don't know what
  // happened before, so we can't add another missing transaction at the end

  return cardActivities;
}

export const validateSearch = (search: {badge?: string}) => {
  if (search.badge && search.badge in badgeConfig) {
    return search as {badge: keyof typeof badgeConfig};
  }
};
