import {Box, Flex, Heading, VStack, Text, SimpleGrid} from '@chakra-ui/react';
import bird from '@twemoji/svg/1f426.svg';
import camping from '@twemoji/svg/1f3d5.svg';
import pretzel from '@twemoji/svg/1f968.svg';
import bucket from '@twemoji/svg/1faa3.svg';
import plane from '@twemoji/svg/2708.svg';
import moneyBag from '@twemoji/svg/1f4b0.svg';
import {useRef, useEffect, useCallback, useId} from 'react';

export default function Badges() {
  return (
    <SimpleGrid columns={[2, null, 3]} gap="10">
      <BadgeBox
        title="Early Bird"
        description="Das Kult hat kaum aufgemacht und du bist schon da?"
        src={bird}
        bgStart="#ABDFFF"
        bgEnd="#3B88C3"
      />

      <BadgeBox
        title="Dauercamper"
        description="Mehr als fünf Stunden auf dem Kult und immer noch hier?"
        src={camping}
        bgStart="#C6E5B3"
        bgEnd="#5C913B"
      />
      <BadgeBox
        title="Lokalpatriot"
        description="Frühschoppen und Weißbiergarten sind deine Heimat"
        src={pretzel}
        bgStart="#AA8DD8"
        bgEnd="#7450A8"
      />
      <BadgeBox
        title="Rich Kid"
        description="Kult ist nur einmal im Jahr, da kann man auch mal Geld ausgeben"
        src={moneyBag}
        bgStart="#F7DECE"
        bgEnd="#F4ABBA"
      />
      <BadgeBox
        title="Globetrotter"
        description="Große Bühne, Kultbühne, Rondell und Waldbühne heute. New York, Rio und Hong Kong morgen"
        src={plane}
        bgStart="#C6E5B3"
        bgEnd="#5C913B"
      />
      <BadgeBox
        title="Bucketlist"
        description="Keine Essensbude, die du nicht besucht hast"
        src={bucket}
        bgStart="#FFE8B6"
        bgEnd="#FFCC4D"
      />
    </SimpleGrid>
  );
}

function BadgeBox({
  title,
  description,
  ...props
}: {title: string; description: string} & React.ComponentProps<typeof Badge>) {
  return (
    <VStack alignItems="center" w="100%">
      <Badge {...props} width="50%" />
      <Heading mt="5">{title}</Heading>
      <Text textAlign="center">{description}</Text>
    </VStack>
  );
}

const DEFAULT_VELOCITY = 0.5;

function Badge(props: {
  enabled?: boolean;
  width?: string;
  src: string;
  bgStart: string;
  bgEnd: string;
}) {
  const isDragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const raf = useRef<number | null>(null);
  const rotation = useRef(Math.random() * 360);
  const velocity = useRef(DEFAULT_VELOCITY);
  const id = useId();

  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const startX =
      e.nativeEvent instanceof MouseEvent
        ? e.nativeEvent.clientX
        : e.nativeEvent.touches[0].clientX;
    const startTime = Date.now();
    let previousX = startX;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX =
        e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      const deltaX = clientX - previousX;
      rotation.current += deltaX * 2; // Adjust the multiplier for sensitivity
      if (svgRef.current) {
        svgRef.current.style.transform = `rotateY(${rotation.current}deg)`;
      }
      previousX = clientX;
    };

    const onEnd = (e: MouseEvent | TouchEvent) => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      const clientX =
        e instanceof MouseEvent ? e.clientX : e.changedTouches[0].clientX;
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime === 0) {
        velocity.current = 20;
        return;
      }
      const distance = clientX - startX;
      if (distance < 4) {
        velocity.current = 20;
        return;
      }
      let speed = distance / elapsedTime;
      velocity.current = speed * 10;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  }, []);

  useEffect(() => {
    const animate = () => {
      if (svgRef.current) {
        if (!isDragging.current) {
          rotation.current += velocity.current;

          if (Math.abs(velocity.current) > DEFAULT_VELOCITY) {
            velocity.current *= 0.97;
          } else if (Math.abs(velocity.current) < DEFAULT_VELOCITY) {
            velocity.current *= 1.03;
          }
        }
        svgRef.current.style.transform = `rotateY(${rotation.current}deg)`;
      }
      raf.current = requestAnimationFrame(animate);
    };

    raf.current = requestAnimationFrame(animate);

    return () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, []);

  return (
    <Box
      w={props.width ?? '100%'}
      flexShrink={0}
      onMouseDown={onStart}
      onTouchStart={onStart}
      cursor="grab"
      touchAction="pan-y"
      // filter={props.enabled === false ? 'grayscale(1)' : undefined}
      filter="drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.15))"
    >
      <svg
        viewBox="0 0 97 109"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        ref={svgRef}
        style={{
          transformOrigin: 'center center',
          perspective: '1000px',
        }}
      >
        <path
          d="M50 5.63953L90.0644 28.7707C90.9926 29.3066 91.5644 30.297 91.5644 31.3688V77.6312C91.5644 78.703 90.9926 79.6934 90.0644 80.2293L50 103.36C49.0718 103.896 47.9282 103.896 47 103.36L6.93559 80.2293C6.00739 79.6934 5.43559 78.703 5.43559 77.6312V31.3688C5.43559 30.297 6.00738 29.3066 6.93559 28.7707L47 5.63953C47.9282 5.10363 49.0718 5.10363 50 5.63953Z"
          fill={`url(#${id})`}
          stroke="white"
          strokeWidth="10"
        />
        <image href={props.src} width="84%" height="84%" x="8%" y="8%" />
        <defs>
          <linearGradient
            id={id}
            x1="48.5"
            y1="-1"
            x2="48.5"
            y2="110"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={props.bgStart} />
            <stop offset="1" stopColor={props.bgEnd} />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  );
}
