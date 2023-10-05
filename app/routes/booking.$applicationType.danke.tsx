import {gql} from '@apollo/client';
import {VStack, Heading, Text, Img} from '@chakra-ui/react';
import type {ThanksQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {ActionArgs, LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import {EVENT_ID} from './booking._index';
import {useEffect} from 'react';
import Confetti from '~/components/booking/Confetti.client';
import DateString from '~/components/DateString';
import {useParams} from '@remix-run/react';
import {ClientOnly, useHydrated} from 'remix-utils';

export type SearchParams = {
  applicationType: 'band' | 'dj';
};

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
    return typedjson(data.node);
  }

  throw new Error(`Event ${EVENT_ID} not found`);
}

export const action = async ({request}: ActionArgs) => {};

export default function Thanks() {
  const hydrated = useHydrated();
  const data = useTypedLoaderData<typeof loader>();
  const {applicationType} = useParams<SearchParams>();
  const applicationEnd =
    applicationType === 'dj' ? data.djApplicationEnd : data.bandApplicationEnd;

  useEffect(() => {
    if (hydrated) {
      (window as any).fbq?.('track', 'CompleteRegistration');
    }
  }, [hydrated]);

  return (
    <>
      <ClientOnly>{() => <Confetti />}</ClientOnly>
      <VStack spacing="5" textAlign="center">
        <Img
          src={
            applicationType === 'dj' ? '/genre/disco.svg' : '/genre/metal.svg'
          }
          width="16"
        />
        <Heading size="lg">
          Danke für {applicationType === 'dj' ? 'deine' : 'eure'} Bewerbung!
        </Heading>
        <Text>
          Wir haben dir soeben eine E-Mail zur Bestätigung geschickt. Wir
          beantworten jede Bewerbung, allerdings kann es bis nach dem
          Bewerbungsschluss am <DateString date={applicationEnd!} /> dauern, bis
          wir uns bei dir melden.
        </Text>
      </VStack>
    </>
  );
}
