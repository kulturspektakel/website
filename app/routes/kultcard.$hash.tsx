import {VStack} from '@chakra-ui/react';
import {Alert} from '../components/chakra-snippets/alert';
import Card from '../components/kultcard/Card';
import InfoText from '../components/kultcard/InfoText';
import {KultCardDocument, KultCardQuery} from '../types/graphql';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {
  CardActivities,
  CardActivity,
} from '../components/kultcard/CardActivities';
import {SegmentedControl} from '../components/chakra-snippets/segmented-control';
import {useState} from 'react';
import {BadgeActivity} from '../components/kultcard/Badges';
import {useBadges} from '../utils/useBadges';
import {prismaClient} from '../utils/prismaClient';
import {decodePayload} from '../utils/cardUtils';
import {isPast, sub} from 'date-fns';

const loader = createServerFn()
  .validator((data: {hash: string; event: {start: Date; end: Date}}) => data)
  .handler(async ({data: {event, hash}}) => {
    const {cardId, counter, balance, deposit} = decodePayload('kultcard', hash);

    const transactions = await prismaClient.cardTransaction.findMany({
      include: {
        DeviceLog: true,
        Order: {
          include: {
            OrderItem: {
              include: {
                ProductList: true,
              },
            },
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
    // remove eveything after the current counter value
    const newerTransactions =
      transactions.findIndex((t) => t.counter! <= counter) + 1;
    if (newerTransactions > 0) {
      transactions.splice(0, newerTransactions);
    }
    // remove everything before last cashout
    const cashout = transactions.findIndex(
      (t) => t.transactionType === 'Cashout',
    );
    if (cashout > -1) {
      transactions.length = cashout;
    }

    const cardActivities: Array<CardActivity> = [];
    let counterBefore = -1;
    let balanceBefore = -1;
    let depositBefore = -1;
    for (let i = transactions.length - 1; i >= 0; i--) {
      const transaction = transactions[i];

      if (counterBefore > -1 && transaction.counter! - counterBefore > 1) {
        cardActivities.push({
          type: 'missing',
          numberOfMissingTransactions: transaction.counter! - counterBefore,
          balanceAfter: transaction.balanceBefore,
          depositAfter: transaction.depositBefore,
          balanceBefore,
          depositBefore,
        });
      }

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

      counterBefore = transaction.counter!;
      balanceBefore = transaction.balanceAfter;
      depositBefore = transaction.depositAfter;
    }

    return {
      cardActivities,
      event,
      hasNewerTransactions: newerTransactions > 0,
      balance,
      deposit,
    };
  });

export const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const Route = createFileRoute('/kultcard/$hash')({
  component: KultCard,
  loader: async ({params: {hash}, context: {event}}) =>
    await loader({data: {hash, event}}),
  head: ({loaderData}) =>
    loaderData
      ? seo({
          title: `KultCard Guthaben ${currencyFormatter.format(loaderData.balance / 100)}`,
        })
      : {},
});

const TABS = ['Buchungen', 'Badges'];

function KultCard() {
  const {hasNewerTransactions, balance, deposit, cardActivities, event} =
    Route.useLoaderData();
  const [active, setActive] = useState(TABS[0]);
  const {awardedBadges, unawardedBadges} = useBadges(
    cardActivities,
    event,
    false,
  );

  return (
    <VStack maxW="450px" mr="auto" ml="auto" align="stretch" minH="70dvh">
      {hasNewerTransactions && (
        <Alert title="Neue Buchungen">
          Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
          anzuzeigen.
        </Alert>
      )}
      <Card balance={balance} deposit={deposit} />

      <SegmentedControl
        mt="5"
        value={active}
        onValueChange={({value}) => setActive(value!)}
        items={TABS.map((t) => ({value: t, label: t}))}
      />
      <VStack gap="5" align="stretch" mt="3">
        {active === 'Buchungen' && (
          <CardActivities newestToOldest={cardActivities} />
        )}
        {active === 'Badges' && (
          <BadgeActivity
            awardedBadges={awardedBadges}
            unawardedBadges={unawardedBadges}
          />
        )}
        <InfoText textAlign="center">
          Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
          dargestellt werden. Das angezeigte Guthaben auf der Karte ist jedoch
          immer aktuell.
        </InfoText>
      </VStack>
    </VStack>
  );
}
