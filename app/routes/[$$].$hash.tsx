import {gql} from '@apollo/client';
import {Box, OrderedList} from '@chakra-ui/react';
import {LoaderFunctionArgs} from '@remix-run/node';
import {$params} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Headline from '~/components/Headline';
import InfoBox from '~/components/InfoBox';
import Card, {CardFragment} from '~/components/kultcard/Card';
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

export const meta = mergeMeta<typeof loader>(({data, params}) => {
  return [
    {
      title: 'KultCard Guthaben',
    },
  ];
});

export async function loader(args: LoaderFunctionArgs) {
  const {hash} = $params('/kultcard/:hash', args.params);
  const {data} = await apolloClient.query<KultCardQuery>({
    query: KultCardDocument,
    variables: {payload: hash},
  });

  return typedjson(data.cardStatus);
}

export default function () {
  const data = useTypedLoaderData<typeof loader>();
  return (
    <Box maxW="450" mr="auto" ml="auto">
      <Card balance={data.balance} deposit={data.deposit} />
      <Box mt="4">
        Das Guthaben der Karte kann an den Bonbuden ausgezahlt werden. Auf der
        Karte selbst sind 2&nbsp;Euro Kartenpfand.
      </Box>
      {data.recentTransactions && data.recentTransactions.length > 0 && (
        <>
          <Headline>Letzte Buchungen</Headline>
          {data.hasNewerTransactions && (
            <InfoBox>
              Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
              anzuzeigen.
            </InfoBox>
          )}
          <OrderedList>
            {data.recentTransactions.map((t, i) => (
              <Transaction key={i} {...t} />
            ))}
          </OrderedList>
          <Box>
            Es kann einige Zeit dauern, bis alle Buchungen vollständig in der
            Liste dargestellt werden. Das angezeigte Guthaben auf der Karte ist
            jedoch immer aktuell.
          </Box>
        </>
      )}
    </Box>
  );
}
