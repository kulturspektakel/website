import {useEffect} from 'react';
import * as Sentry from '@sentry/tanstackstart-react';
import Headline from './Headline';
import {Text} from '@chakra-ui/react';

export function Error({error}: {error?: Error}) {
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
