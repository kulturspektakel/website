import {Heading, Text, Box, Image, Spinner} from '@chakra-ui/react';
import {FaPlay, FaPause} from 'react-icons/fa6';
import DateString from '../DateString';
import Card from '../Card';
import {imageUrl} from '../../utils/directusImage';
import type {SpotifyPlayerState} from '../SpotifyPlayer';

export default function Band({
  band,
  area,
  player,
}: {
  area: {
    id: string;
    displayName: string;
    themeColor: string;
  };
  band: {
    name: string;
    startTime: Date;
    slug: string;
    genre: string | null;
    photo: string | null;
    spotifyTrackId?: string | null;
  };
  player: SpotifyPlayerState;
}) {
  const trackId = band.spotifyTrackId ?? null;
  const {activeTrackId, isPlaying, loadingTrackId, toggle} = player;
  const isLoading = trackId != null && loadingTrackId === trackId;
  const showPause =
    trackId != null && activeTrackId === trackId && isPlaying && !isLoading;

  return (
    <Card
      aspectRatio={1}
      link={{
        to: '/lineup/$year/$slug',
        params: {
          year: String(band.startTime.getFullYear()),
          slug: band.slug,
        },
      }}
    >
      <Image
        width="100%"
        height="100%"
        src={imageUrl(band.photo, {width: 464}) ?? '/fallback.svg'}
        loading="lazy"
        objectFit="cover"
      />
      {trackId && (
        <Box
          asChild
          position="absolute"
          top="2"
          right="2"
          width="44px"
          height="44px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          bgColor="brand.500/30"
          backdropFilter="blur(8px)"
          color="white"
          cursor="pointer"
          transition="background-color 0.15s ease-in-out, transform 0.1s ease-in-out"
          _hover={{bgColor: 'brand.500/50'}}
          _active={{transform: 'scale(0.95)'}}
        >
          <button
            type="button"
            aria-label={
              isLoading
                ? `Loading ${band.name}`
                : showPause
                  ? `Pause ${band.name}`
                  : `Play ${band.name}`
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(trackId);
            }}
          >
            {isLoading ? (
              <Spinner size="sm" color="white" borderWidth="2px" />
            ) : showPause ? (
              <FaPause size={16} />
            ) : (
              <FaPlay size={16} style={{marginLeft: 2}} />
            )}
          </button>
        </Box>
      )}
      <Box
        position="absolute"
        bottom="2"
        left="2"
        mr="2"
        bgColor={area.themeColor}
        pt="2"
        pb="1"
        px="2"
        color={area.id === 'Area:a' ? undefined : 'white'}
        textAlign="left"
        borderRadius="md"
      >
        <Heading
          hyphens="auto"
          fontSize={['md', 'lg', '2xl']}
          lineClamp={4}
          color="inherit"
          as="h3"
        >
          {band.name}
        </Heading>

        <Text
          lineClamp={2}
          lineHeight="1.1"
          fontWeight="bold"
          fontSize={['xs', 'sm']}
          mt="0.5"
        >
          <DateString
            timeOnly
            date={band.startTime}
            options={{
              hour: '2-digit',
              minute: '2-digit',
            }}
          />
          &nbsp;
          {area.displayName}
          {band.genre && <>&nbsp;&middot; {band.genre}</>}
        </Text>
      </Box>
    </Card>
  );
}
