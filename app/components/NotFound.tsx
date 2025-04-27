import Headline from './Headline';
import {Image} from '@chakra-ui/react';

export function NotFound() {
  return (
    <>
      <Headline mb="4">Seite nicht gefunden</Headline>
      <Image
        src="/404.svg"
        alt="Trauriger Roboter der die Seite nicht finden konnte"
      />
    </>
  );
}
