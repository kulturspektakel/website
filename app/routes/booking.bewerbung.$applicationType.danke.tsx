import {gql} from '@apollo/client';
import {VStack, Heading, Text, Img} from '@chakra-ui/react';
import Confetti from '~/components/booking/Confetti';
import useIsDJ from '~/components/booking/useIsDJ';
import type {ThanksQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import {EVENT_ID} from './booking.bewerbung._index';

type Props = Extract<ThanksQuery['node'], {__typename?: 'Event'}>;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<ThanksQuery>({
    query: gql`
      query Thanks($id: ID!) {
        node(id: $id) {
          ... on Event {
            bandApplicationEnd
            djApplicationEnd
          }
        }
      }
    `,
    variables: {
      id: EVENT_ID,
    },
  });

  if (data.node?.__typename === 'Event') {
    return typedjson(data);
  }

  throw new Error(`Event ${EVENT_ID} not found`);
}

export default function Thanks(props: Props) {
  const isDJ = useIsDJ();
  const data = useTypedLoaderData<typeof loader>();

  const applicationEnd = isDJ ? data.djApplicationEnd : data.bandApplicationEnd;

  return (
    <>
      <Confetti />
      <VStack spacing="5" textAlign="center">
        <Img src={isDJ ? '/genre/disco.svg' : '/genre/metal.svg'} width="16" />
        <Heading size="lg">
          Danke für {isDJ ? 'deine' : 'eure'} Bewerbung!
        </Heading>
        <Text>
          Wir haben dir soeben eine E-Mail zur Bestätigung geschickt. Wir
          beantworten jede Bewerbung, allerdings kann es bis nach dem
          Bewerbungsschluss am{' '}
          {applicationEnd &&
            applicationEnd.toLocaleDateString('de', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              timeZone: 'Europe/Berlin',
            })}{' '}
          dauern, bis wir uns bei dir melden.
        </Text>
      </VStack>
    </>
  );
}
