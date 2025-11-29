import {VStack, Heading, Text, Image} from '@chakra-ui/react';
import Confetti from '../components/booking/Confetti.client';
import DateString from '../components/DateString';
import {createFileRoute} from '@tanstack/react-router';
import {parseBookingParams} from './booking_.$applicationType';
import useFacebookPixel from '../utils/useFacebookPixel';
import {useEffect} from 'react';

export const Route = createFileRoute('/booking_/$applicationType_/danke')({
  component: Thanks,
  parseParams: parseBookingParams,
});

function Thanks() {
  const {event} = Route.useRouteContext();
  const {applicationType} = Route.useParams();
  const applicationEnd =
    applicationType === 'dj'
      ? event.djApplicationEnd
      : event.bandApplicationEnd;

  const pixel = useFacebookPixel();
  useEffect(() => {
    pixel?.trackEvent('SubmitApplication');
  }, [pixel]);

  return (
    <>
      <Confetti />
      <VStack gap="5" textAlign="center">
        <Image
          src={
            applicationType === 'dj' ? '/genre/disco.svg' : '/genre/metal.svg'
          }
          width="16"
        />
        <Heading size="3xl">
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
