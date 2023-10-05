import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';
import ReactPixel from 'react-facebook-pixel';
import {useEffect} from 'react';

export default function ConfettiComponent() {
  const {width, height} = useWindowSize();

  useEffect(() => {
    ReactPixel.track('CompleteRegistration');
  }, []);

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
