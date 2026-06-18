import {ClientOnly} from '@chakra-ui/react';
import {useEffect, useState} from 'react';
import Confetti from 'react-confetti';

function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const handler = () =>
      setSize({width: window.innerWidth, height: window.innerHeight});
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

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
