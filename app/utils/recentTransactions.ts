import {prismaClient} from './prismaClient';

type BaseTransaction<T extends string, S> = S & {
  transactionType: T;
  deviceTime: Date;
};

type Transaction = BaseTransaction<
  'missing',
  {
    numberOfMissingTransactions: number;
  }
>;

export async function recentTransactions() {
  let hasNewerTransactions = false;
  let recentTransactions: Transaction[] = [];

  const transactions = await prismaClient.cardTransaction.findMany({
    include: {
      deviceLog: {
        select: {
          deviceTime: true,
        },
      },
    },
    where: {
      cardId: data.cardId,
      deviceLog: {
        deviceTime: {
          gte: sub(new Date(), {days: 3}),
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
  recentTransactions = [];
  const startCounter = transactions.findIndex(
    (t) => t.counter === data.counter,
  );
  if (startCounter > 0) {
    hasNewerTransactions = true;
    transactions.splice(0, startCounter);
  }

  // remove everything before last cashout
  const cashout = transactions.findIndex(
    (t) => t.transactionType === 'Cashout',
  );
  if (cashout > -1) {
    transactions.length = cashout;
  }
  if (transactions.length > 0) {
    let ti = 0;
    let numberOfMissingTransactions = 0;
    let deposit = data.deposit;
    let balance = data.balance;
    for (
      let c = data.counter;
      c >= transactions[transactions.length - 1].counter!;
      c--
    ) {
      if (transactions[ti].counter! === c) {
        if (numberOfMissingTransactions > 0) {
          const missingTransaction = new MissingTransaction(
            {
              depositAfter: deposit,
              balanceAfter: balance,
              depositBefore: transactions[ti].depositAfter,
              balanceBefore: transactions[ti].balanceAfter,
            },
            numberOfMissingTransactions,
          );

          recentTransactions.push(missingTransaction);
          numberOfMissingTransactions = 0;
        }
        if (transactions[ti].transactionType === 'Repair') {
          continue;
        }
        deposit = transactions[ti].depositBefore;
        balance = transactions[ti].balanceBefore;
        recentTransactions.push(transactions[ti]);
        ti++;
      } else {
        numberOfMissingTransactions++;
      }
    }
  }
}
