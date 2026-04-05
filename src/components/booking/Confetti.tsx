import {ClientOnly} from '@chakra-ui/react';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

export default function () {
  return (
    <ClientOnly>
      <ConfettiComponent />
    </ClientOnly>
  );
}

function ConfettiComponent() {
  const {width, height} = useWindowSize();
  return (
    <Confetti
      width={width}
      height={height}
      numberOfPieces={500}
      tweenDuration={10000}
      recycle={false}
    />
  );
}
