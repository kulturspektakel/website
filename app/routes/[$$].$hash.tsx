import {gql} from '@apollo/client';
import {ListRoot, VStack} from '@chakra-ui/react';
import {LoaderFunctionArgs} from '@remix-run/node';
import {useRevalidator} from '@remix-run/react';
import {useEffect} from 'react';
import {$params} from 'remix-routes';
import {
  typedjson,
  UseDataFunctionReturn,
  useTypedLoaderData,
} from 'remix-typedjson';
import {Alert} from '~/components/chakra-snippets/alert';
import Card, {CardFragment} from '~/components/kultcard/Card';
import InfoText from '~/components/kultcard/InfoText';
import Transaction, {CardTransaction} from '~/components/kultcard/Transaction';
import {KultCardDocument, KultCardQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import mergeMeta from '~/utils/mergeMeta';

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

const EXAMPLE_DATA: UseDataFunctionReturn<typeof loader> = {
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

export const meta = mergeMeta<typeof loader>(({data, params}) => {
  return [
    {
      title: 'KultCard Guthaben',
    },
  ];
});

export async function loader(args: LoaderFunctionArgs) {
  const {hash} = $params('/$$/:hash', args.params);
  const {data} = await apolloClient.query<KultCardQuery>({
    query: KultCardDocument,
    variables: {payload: hash},
  });

  return typedjson(data.cardStatus);
}

export default function () {
  const revalidator = useRevalidator();
  useEffect(() => {
    const timeout = setTimeout(() => revalidator.revalidate(), 60000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        revalidator.revalidate();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [revalidator]);

  const data = useTypedLoaderData<typeof loader>();

  return (
    <VStack
      maxW="450"
      mr="auto"
      ml="auto"
      gap="7"
      minH="calc(100vh - 148px)"
      align="stretch"
      justifyContent="center"
    >
      {data.hasNewerTransactions && (
        <Alert title="Neue Buchungen">
          Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
          anzuzeigen.
        </Alert>
      )}
      <Card balance={data.balance} deposit={data.deposit} />

      {data.recentTransactions && data.recentTransactions.length > 0 && (
        <VStack gap="5" align="stretch">
          <ListRoot as="ol" m="0">
            {data.recentTransactions.map((t, i) => (
              <Transaction
                key={i}
                {...t}
                isLastItem={i === data.recentTransactions!.length - 1}
              />
            ))}
          </ListRoot>
          <InfoText textAlign="center">
            Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
            dargestellt werden. Das angezeigte Guthaben auf der Karte ist jedoch
            immer aktuell.
          </InfoText>
        </VStack>
      )}
    </VStack>
  );
}
