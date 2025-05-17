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

export const Route = createFileRoute('/crewcard/$hash')({
  component: CrewCard,
  loader: async ({params}) => await loader({data: params}),
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

function CrewCard() {
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
