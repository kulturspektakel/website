import {gql} from '@apollo/client';
import {ListRoot, VStack} from '@chakra-ui/react';
import {Alert} from '../components/chakra-snippets/alert';
import Card, {CardFragment} from '../components/kultcard/Card';
import InfoText from '../components/kultcard/InfoText';
import Transaction, {CardTransaction} from '../components/kultcard/Transaction';
import {KultCardDocument, KultCardQuery} from '../types/graphql';
import apolloClient from '../utils/apolloClient';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';

gql`
  query KultCard($payload: String!) {
    cardStatus(payload: $payload) {
      ...CardFragment
      cardId
      hasNewerTransactions
      recentTransactions {
        ...CardTransaction
      }
    }
  }
  ${CardFragment}
  ${CardTransaction}
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
  .validator((data: {hash: string}) => data)
  .handler(async ({data}) => {
    const result = await apolloClient.query<KultCardQuery>({
      query: KultCardDocument,
      variables: {payload: data.hash},
    });

    if (!result.data?.cardStatus) {
      throw notFound();
    }

    return result.data.cardStatus;
  });

export const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const Route = createFileRoute('/$$$/$hash')({
  component: KultCard,
  loader: async ({params}) => await loader({data: params}),
  head: ({loaderData}) =>
    seo({
      title: `KultCard Guthaben ${currencyFormatter.format(loaderData.balance / 100)}`,
    }),
});

function KultCard() {
  const cardStatus = Route.useLoaderData(); // EXAMPLE_DATA

  return (
    <VStack
      maxW="450px"
      mr="auto"
      ml="auto"
      gap="7"
      minH="calc(100dvh - 148px)"
      align="stretch"
      justifyContent="center"
    >
      {cardStatus.hasNewerTransactions && (
        <Alert title="Neue Buchungen">
          Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
          anzuzeigen.
        </Alert>
      )}
      <Card balance={cardStatus.balance} deposit={cardStatus.deposit} />

      {cardStatus.recentTransactions &&
        cardStatus.recentTransactions.length > 0 && (
          <VStack gap="5" align="stretch">
            <ListRoot as="ol" m="0">
              {cardStatus.recentTransactions.map((t, i) => (
                <Transaction
                  key={i}
                  {...t}
                  isLastItem={i === cardStatus.recentTransactions!.length - 1}
                />
              ))}
            </ListRoot>
            <InfoText textAlign="center">
              Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
              dargestellt werden. Das angezeigte Guthaben auf der Karte ist
              jedoch immer aktuell.
            </InfoText>
          </VStack>
        )}
    </VStack>
  );
}
