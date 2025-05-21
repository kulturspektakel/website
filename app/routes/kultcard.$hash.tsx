import {gql} from '@apollo/client';
import {VStack} from '@chakra-ui/react';
import {Alert} from '../components/chakra-snippets/alert';
import Card, {CardFragment} from '../components/kultcard/Card';
import InfoText from '../components/kultcard/InfoText';
import {KultCardDocument, KultCardQuery} from '../types/graphql';
import apolloClient from '../utils/apolloClient';
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

gql`
  query KultCard($payload: String!) {
    cardStatus(payload: $payload) {
      ...CardFragment
      cardId
      hasNewerTransactions
      recentTransactions {
        depositBefore
        depositAfter
        balanceBefore
        balanceAfter
        __typename

        ... on CardTransaction {
          deviceTime
          transactionType
          Order {
            items {
              amount
              name
              productList {
                emoji
                name
              }
            }
          }
        }
        ... on MissingTransaction {
          numberOfMissingTransactions
        }
      }
    }
  }
  ${CardFragment}
`;

const EXAMPLE_DATA = {
  balance: 1000,
  deposit: 2,
  cardId: '123456',
  hasNewerTransactions: false,
  recentTransactions: [
    {
      __typename: 'CardTransaction',
      deviceTime: new Date(),
      depositBefore: 0,
      depositAfter: 1,
      balanceAfter: 1000,
      balanceBefore: 1600,
      Order: {
        items: [
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
          {
            amount: 1,
            name: 'Helles',
            productList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
        ],
      },
    },
    {
      __typename: 'MissingTransaction',
      numberOfMissingTransactions: 2,
      depositBefore: 0,
      depositAfter: 1,
      balanceAfter: 1000,
      balanceBefore: 1600,
    },
    {
      __typename: 'CardTransaction',
      deviceTime: new Date(),
      depositBefore: 1,
      depositAfter: 0,
      balanceAfter: 1600,
      balanceBefore: 1400,
    },
  ],
};

const loader = createServerFn()
  .validator((data: {hash: string; event: {start: Date; end: Date}}) => data)
  .handler(async ({data}) => {
    const result = await apolloClient.query<KultCardQuery>({
      query: KultCardDocument,
      variables: {payload: data.hash},
    });

    if (!result.data?.cardStatus) {
      throw notFound();
    }

    const {recentTransactions, ...cardStatus} = result.data.cardStatus;

    const cardActivities =
      recentTransactions?.map<CardActivity>((t) => {
        const cardChange = {
          depositAfter: t.depositAfter,
          depositBefore: t.depositBefore,
          balanceAfter: t.balanceAfter,
          balanceBefore: t.balanceBefore,
        };

        if (t.__typename === 'MissingTransaction') {
          return {
            type: 'missing' as const,
            numberOfMissingTransactions: t.numberOfMissingTransactions,
            ...cardChange,
          };
        }

        if (t.Order && t.Order.items.length > 0) {
          const productList = t.Order.items.find(() => true)?.productList;
          return {
            type: 'order' as const,
            items: t.Order.items,
            productList: productList?.name ?? '',
            emoji: productList?.emoji ?? null,
            time: t.deviceTime,
            cardChange,
          };
        }
        return {
          type: 'generic' as const,
          time: t.deviceTime,
          ...cardChange,
        };
      }) ?? [];

    return {
      cardStatus,
      cardActivities,
      event: data.event,
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
    seo({
      title: `KultCard Guthaben ${loaderData ? currencyFormatter.format(loaderData.cardStatus.balance / 100) : ''}`,
    }),
});

const TABS = ['Buchungen', 'Badges'];

function KultCard() {
  const {cardStatus, cardActivities, event} = Route.useLoaderData();
  const [active, setActive] = useState(TABS[0]);
  const {awardedBadges, unawardedBadges} = useBadges(
    cardActivities,
    event,
    false,
  );

  return (
    <VStack maxW="450px" mr="auto" ml="auto" align="stretch" minH="70dvh">
      {cardStatus.hasNewerTransactions && (
        <Alert title="Neue Buchungen">
          Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
          anzuzeigen.
        </Alert>
      )}
      <Card balance={cardStatus.balance} deposit={cardStatus.deposit} />

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
