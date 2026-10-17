import {useEffect} from 'react';
import * as Sentry from '@sentry/tanstackstart-react';
import Headline from './Headline';
import {Text} from '@chakra-ui/react';
import {useMatch} from '@tanstack/react-router';
import {CrewError} from './CrewError';

export function Error({error, reset}: {error: unknown; reset?: () => void}) {
  // Errors in a /crew child route land here (a route's `errorComponent` isn't
  // inherited by its children); the crew gets the technical view instead.
  const crew = useMatch({from: '/crew', shouldThrow: false});
  if (crew) {
    return <CrewError error={error} reset={reset} />;
  }
  return <PublicError error={error} />;
}

function PublicError({error}: {error: unknown}) {
  useEffect(() => {
    if (error) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <>
      <Headline mb="4">Fehler</Headline>
      <Text>Da stimmt etwas nicht. Hast du es kaputt gemacht?</Text>
    </>
  );
}
