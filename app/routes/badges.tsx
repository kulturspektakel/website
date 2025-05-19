import {Box, Heading, VStack, Text, SimpleGrid} from '@chakra-ui/react';
import bird from '@twemoji/svg/1f426.svg';
import camping from '@twemoji/svg/1f3d5.svg';
import pretzel from '@twemoji/svg/1f968.svg';
import bucket from '@twemoji/svg/1faa3.svg';
import plane from '@twemoji/svg/2708.svg';
import moneyBag from '@twemoji/svg/1f4b0.svg';
import {useRef, useEffect, useCallback, useId} from 'react';
import {createFileRoute} from '@tanstack/react-router';
import {CardActivity} from '../components/kultcard/CardActivities';

export const Route = createFileRoute('/badges')({
  component: Badges,
});

type BadgeDescription = {
  name: string;
  description: string;
  bgStart: string;
  bgEnd: string;
  crewOnly: boolean;
  emoji: string;
};

type ComputeFn = (
  cardActivities: Array<CardActivity>,
  event: {start: Date; end: Date},
) =>
  | {
      awardedAt: Date;
    }
  | null
  | undefined
  | void;

export const badgeConfig: Record<
  string,
  BadgeDescription & {compute: ComputeFn}
> = {
  earlybird: {
    name: 'Early Bird',
    description: 'Das Kult hat kaum aufgemacht und du bist schon da?',
    bgStart: '#ABDFFF',
    bgEnd: '#3B88C3',
    emoji: '1f426',
    crewOnly: false,
    compute: () => {},
  },
  dauercamper: {
    name: 'Dauercamper',
    description: 'Mehr als fünf Stunden auf dem Kult und immer noch hier?',
    bgStart: '#C6E5B3',
    bgEnd: '#5C913B',
    emoji: '1f3d5',
    crewOnly: false,
    compute: () => {},
  },
  lokalpatriot: {
    name: 'Lokalpatriot',
    description: 'Frühschoppen und Weißbiergarten sind deine Heimat',
    bgStart: '#AA8DD8',
    bgEnd: '#7450A8',
    emoji: '1f968',
    crewOnly: false,
    compute: () => {},
  },
  richkid: {
    name: 'Rich Kid',
    description:
      'Kult ist nur einmal im Jahr, da kann man auch mal Geld ausgeben',
    bgStart: '#F7DECE',
    bgEnd: '#F4ABBA',
    emoji: '1f4b0',
    crewOnly: false,
    compute: () => {},
  },
  globetrotter: {
    name: 'Globetrotter',
    description:
      'Große Bühne, Kultbühne, Rondell und Waldbühne heute. New York, Rio und Hong Kong morgen',
    bgStart: '#C6E5B3',
    bgEnd: '#5C913B',
    emoji: '2708',
    crewOnly: false,
    compute: () => {},
  },
  bucketlist: {
    name: 'Bucketlist',
    description: 'Keine Essensbude, die du nicht besucht hast',
    bgStart: '#FFE8B6',
    bgEnd: '#FFCC4D',
    emoji: '1faa3',
    crewOnly: false,
    compute: () => {},
  },
};

export function Badges() {
  return (
    <SimpleGrid columns={[2, null, 3]} gap="10">
      {Object.keys(badgeConfig).map((key) => (
        <BadgeBox key={key} type={key} />
      ))}
    </SimpleGrid>
  );
}

function BadgeBox({type}: {type: keyof typeof badgeConfig}) {
  const {name, description} = badgeConfig[type];

  return (
    <VStack alignItems="center" w="100%">
      <Badge type={type} width="50%" />
      <Heading mt="5">{name}</Heading>
      <Text textAlign="center">{description}</Text>
    </VStack>
  );
}

const DEFAULT_VELOCITY = 0.5;

export function Badge(props: {
  enabled?: boolean;
  width?: string;
  type: keyof typeof badgeConfig;
}) {
  const enabled = props.enabled === false ? false : true;
  const {emoji, bgStart, bgEnd} = badgeConfig[props.type];
  const src = {
    '1f426': bird,
    '1f3d5': camping,
    '1f968': pretzel,
    '1faa3': bucket,
    '2708': plane,
    '1f4b0': moneyBag,
  }[emoji];

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
      window.removeEventListener('blur', onEnd);
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
    window.addEventListener('blur', onEnd);
  }, []);

  useEffect(() => {
    const animate = () => {
      if (svgRef.current) {
        if (!isDragging.current) {
          rotation.current += velocity.current;

          if (Math.abs(velocity.current) > DEFAULT_VELOCITY) {
            velocity.current *= 0.96;
          } else if (Math.abs(velocity.current) < DEFAULT_VELOCITY) {
            velocity.current *= 1.04;
          }
        }
        svgRef.current.style.transform = `rotateY(${rotation.current}deg)`;
      }
      raf.current = requestAnimationFrame(animate);
    };

    if (enabled) {
      raf.current = requestAnimationFrame(animate);
    }

    return () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [enabled]);

  return (
    <Box
      w={props.width ?? '100%'}
      flexShrink={0}
      onMouseDown={onStart}
      onTouchStart={onStart}
      cursor="grab"
      touchAction="pan-y"
      transition="transform 0.2s ease"
      _active={{
        transform: 'scale(0.8)',
      }}
      filter={
        enabled
          ? 'drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.15))'
          : 'grayscale(1)'
      }
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
        <image href={src} width="84%" height="84%" x="8%" y="8%" />
        <defs>
          <linearGradient
            id={id}
            x1="48.5"
            y1="-1"
            x2="48.5"
            y2="110"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={bgStart} />
            <stop offset="1" stopColor={bgEnd} />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  );
}
