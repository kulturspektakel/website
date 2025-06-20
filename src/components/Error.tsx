import Headline from './Headline';
import {Text} from '@chakra-ui/react';

export function Error() {
  return (
    <>
      <Headline mb="4">Fehler</Headline>
      <Text>Da stimmt etwas nicht. Hast du es kaputt gemacht?</Text>
    </>
  );
}
