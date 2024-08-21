import {VStack, Heading, Text, Img} from '@chakra-ui/react';
import Confetti from '~/components/booking/Confetti.client';
import DateString from '~/components/DateString';
import {useParams} from '@remix-run/react';
import {ClientOnly} from 'remix-utils/client-only';
import type {loader as rootLoader} from '~/root';
import {useTypedRouteLoaderData} from 'remix-typedjson';

export type SearchParams = {
  applicationType: 'band' | 'dj';
};

export default function Thanks() {
  const root = useTypedRouteLoaderData<typeof rootLoader>('root')!;
  const event = root.eventsConnection.edges[0].node;
  const {applicationType} = useParams<SearchParams>();
  const applicationEnd =
    applicationType === 'dj'
      ? event.djApplicationEnd
      : event.bandApplicationEnd;

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
          Bewerbungsschluss{' '}
          {applicationEnd && (
            <>
              am <DateString date={applicationEnd} />
            </>
          )}{' '}
          dauern, bis wir uns bei dir melden.
        </Text>
      </VStack>
    </>
  );
}
