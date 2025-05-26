import {
  Box,
  Heading,
  ListRoot,
  SimpleGrid,
  VStack,
  Text,
  Progress,
  HStack,
} from '@chakra-ui/react';
import {useRef, useEffect, useCallback, useId} from 'react';
import {badgeConfig, BadgeStatus} from '../../utils/badgeConfig';
import {Cell} from './CardActivities';

const DEFAULT_VELOCITY = 0.5;

export function Badge(props: {
  enabled?: boolean;
  width?: string;
  type: keyof typeof badgeConfig;
}) {
  const enabled = props.enabled === false ? false : true;
  const {bgStart, bgEnd, emoji} = badgeConfig[props.type];

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
      onMouseDown={enabled ? onStart : undefined}
      onTouchStart={enabled ? onStart : undefined}
      cursor={enabled ? 'grab' : undefined}
      touchAction="pan-y"
      transition="transform 0.2s ease"
      _active={
        enabled
          ? {
              transform: 'scale(0.8)',
            }
          : undefined
      }
      filter={
        enabled
          ? 'drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.15))'
          : 'grayscale(1) sepia(0.1)'
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
        <image href={emoji} width="84%" height="84%" x="8%" y="8%" />
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

export function BadgeActivity({
  awardedBadges,
  unawardedBadges,
}: {
  awardedBadges: Array<BadgeStatus & {badgeKey: keyof typeof badgeConfig}>;
  unawardedBadges: Array<BadgeStatus & {badgeKey: keyof typeof badgeConfig}>;
}) {
  return (
    <>
      <VStack
        gap="4"
        align="stretch"
        separator={
          <Box
            borderTopColor="offwhite.200"
            borderTopStyle="solid"
            borderTopWidth={1}
          />
        }
      >
        {awardedBadges.length > 0 && (
          <SimpleGrid columns={[2, 2, 3]} gap="3">
            {awardedBadges.map(
              ({status, badgeKey}) =>
                status && (
                  <VStack alignItems="center" w="100%">
                    <Badge type={badgeKey} width="50%" />
                    <Heading mt="5">{badgeConfig[badgeKey].name}</Heading>
                    <Text textAlign="center" fontSize="sm" color="offwhite.500">
                      {badgeConfig[badgeKey].description}
                    </Text>
                  </VStack>
                ),
            )}
          </SimpleGrid>
        )}
        <ListRoot as="ol" m="0">
          {unawardedBadges.map((badge) => (
            <Cell
              key={badge.badgeKey}
              accessoryStart={<Badge enabled={false} type={badge.badgeKey} />}
              title={
                <Text color="offwhite.500">
                  {badgeConfig[badge.badgeKey].name}
                </Text>
              }
              description={badgeConfig[badge.badgeKey].description}
              subtitle={
                badge.status === 'not awarded' &&
                badge.progress && (
                  <Progress.Root
                    defaultValue={
                      badge.progress.current / badge.progress.target
                    }
                    maxW="sm"
                    my="1"
                  >
                    <HStack gap="2">
                      <Progress.Track flex="1">
                        <Progress.Range />
                      </Progress.Track>
                      <Progress.ValueText color="offwhite.500">
                        {badge.progress.current}/{badge.progress.target}
                      </Progress.ValueText>
                    </HStack>
                  </Progress.Root>
                )
              }
            />
          ))}
        </ListRoot>
      </VStack>
    </>
  );
}
