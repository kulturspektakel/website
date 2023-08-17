import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';
import {useLayoutEffect, useState} from 'react';

export default function ConfettiComponent() {
  const [mounted, setMounted] = useState(false);
  const {width, height} = useWindowSize();
  useLayoutEffect(() => setMounted(true), [width, height]);

  if (!mounted) {
    return null;
  }
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
