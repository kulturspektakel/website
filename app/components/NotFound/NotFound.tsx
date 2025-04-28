import Headline from '../Headline';
import {Image} from '@chakra-ui/react';
import FourOhFour from './404.svg';

export function NotFound() {
  return (
    <>
      <Headline mb="4">Seite nicht gefunden</Headline>
      <Image
        src={FourOhFour}
        alt="Trauriger Roboter der die Seite nicht finden konnte"
      />
    </>
  );
}
