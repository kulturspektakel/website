import {
  Box,
  Heading,
  Stack,
  Link as ChakraLink,
  Text,
  Flex,
  ClientOnly,
} from '@chakra-ui/react';
import Image from '../Image';
import Photos from './Photos';
import Countdown from 'react-countdown';
import {Link} from '@tanstack/react-router';
import {DirectusImage, imageUrl} from '../../utils/directusImage';
import {Prisma} from '@prisma/client';

export const eventSelect: Prisma.EventSelect = {
  id: true,
  name: true,
  description: true,
  location: true,
  start: true,
  end: true,
  poster: true,
  eventType: true,
  BandPlaying: {
    select: {
      name: true,
    },
    where: {
      OR: [{announcementTime: {lte: new Date()}}, {announcementTime: null}],
    },
  },
};

export default function Event({
  event,
}: {
  event: {
    id: string;
    start: Date;
    end: Date;
    name: string;
    description: string | null;
    location: string | null;
    poster: DirectusImage | null;
    BandPlaying: Array<{
      name: string;
    }>;
    media: {
      files: DirectusImage[];
      totalCount: number;
    };
  };
}) {
  return (
    <Stack
      direction={['column', 'row']}
      gap="5"
      mt="5"
      align={['center', 'flex-start']}
    >
      {event.poster && (
        <Image
          w="200px"
          flexShrink="0"
          src={imageUrl(event.poster.id, {width: 200})}
          original={imageUrl(event.poster.id, {width: 1600})}
          originalHeight={event.poster.height}
          originalWidth={event.poster.width}
          alt={`${event.name} Poster`}
          caption={
            event.poster.copyright
              ? `Gestaltung: ${event.poster.copyright}`
              : undefined
          }
        />
      )}
      <Box w="100%">
        {event.start.getTime() > new Date().getTime() && (
          <Flex
            textAlign="center"
            fontWeight="bold"
            alignItems="center"
            flexDirection="row"
            w="100%"
            bg="brand.900"
            color="white"
            borderRadius="lg"
            boxShadow="lg"
            maxW="500px"
            pb="2"
            h={['80px', '110px']}
            mx="auto"
            mt="3"
            mb="3"
            transform="rotate(1deg)"
          >
            <ClientOnly>
              <Countdown
                date={event.start}
                renderer={({days, hours, minutes, seconds}) => (
                  <>
                    <Box flexBasis={1} flexGrow={1}>
                      <Text
                        fontSize={['xx-large', 'xxx-large']}
                        fontFamily="Shrimp"
                        mb="-3"
                      >
                        {days}
                      </Text>
                      <Text>Tage</Text>
                    </Box>
                    <Box flexBasis={1} flexGrow={1}>
                      <Text
                        fontSize={['xx-large', 'xxx-large']}
                        fontFamily="Shrimp"
                        mb="-3"
                      >
                        {hours}
                      </Text>
                      <Text>Stunden</Text>
                    </Box>
                    <Box flexBasis={1} flexGrow={1}>
                      <Text
                        fontSize={['xx-large', 'xxx-large']}
                        fontFamily="Shrimp"
                        mb="-3"
                      >
                        {minutes}
                      </Text>
                      <Text>Minuten</Text>
                    </Box>
                    <Box flexBasis={1} flexGrow={1}>
                      <Text
                        fontSize={['xx-large', 'xxx-large']}
                        fontFamily="Shrimp"
                        mb="-3"
                      >
                        {seconds}
                      </Text>
                      <Text>Sekunden</Text>
                    </Box>
                  </>
                )}
              />
            </ClientOnly>
          </Flex>
        )}
        {event.description && <Box>{event.description}</Box>}
        {event.BandPlaying.length > 0 && (
          <>
            <Heading as="h3" size="md" mb="2">
              Lineup
            </Heading>
            <Box>
              mit{' '}
              {event.BandPlaying.slice(0, 12)
                .map((b) => b.name)
                .join(', ')}{' '}
              <ChakraLink asChild display="inline">
                <Link
                  to="/lineup/$year"
                  params={{year: event.start.getFullYear().toString()}}
                >
                  {event.BandPlaying.length > 12 ? (
                    <>
                      und {event.BandPlaying.length - 12} weiteren Bands&hellip;
                    </>
                  ) : (
                    <>Lineup</>
                  )}
                </Link>
              </ChakraLink>
            </Box>
          </>
        )}

        {event.media.files.length > 0 && (
          <>
            <Heading as="h3" size="lg" mt="4" mb="2" id="fotos">
              Fotos
            </Heading>
            <Photos
              eventId={event.id}
              files={event.media.files}
              totalCount={event.media.totalCount}
            />
          </>
        )}
      </Box>
    </Stack>
  );
}
