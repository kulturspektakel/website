import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

export default function ConfettiComponent() {
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
