import {addDays} from 'date-fns';
import {CardActivity} from '../components/kultcard/CardActivities';
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

export function transformCardAvtivities(
  transactions: Array<{
    balanceAfter: number;
    balanceBefore: number;
    depositAfter: number;
    depositBefore: number;
    counter: number | null;
    cardId: string;
    transactionType: string;
    Order: {
      createdAt: Date;
      items: Array<{
        amount: number;
        name: string;
        productList: {name: string; emoji: string | null} | null;
      }>;
    } | null;
    deviceLog: {deviceTime: Date};
  }>,
  counter: number,
  balance: number,
  deposit: number,
): Array<CardActivity> {
  // remove eveything after the current counter value
  const firstTransactionIndex = transactions.findIndex(
    (t) => t.counter! <= counter,
  );
  if (firstTransactionIndex > 0) {
    transactions.splice(0, firstTransactionIndex);
  }
  // remove everything before last cashout
  const cashout = transactions.findIndex(
    (t) => t.transactionType === 'Cashout' || t.transactionType === 'Donation',
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
          transaction.Order.items?.[0].productList?.name ?? 'Unbekannt',
        emoji: transaction.Order.items?.[0].productList?.emoji ?? null,
        time: transaction.Order.createdAt,
        items: transaction.Order.items.map((oi) => ({
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
        time: transaction.deviceLog.deviceTime,
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
