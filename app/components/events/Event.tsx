import {
  Box,
  Heading,
  Stack,
  Link as ChakraLink,
  Text,
  Flex,
} from '@chakra-ui/react';
import {$path} from 'remix-routes';
import {gql} from '@apollo/client';
import Image from '~/components/Image';
import Photos from '~/components/events/Photos';
import type {EventDetailsFragment} from '~/types/graphql';
import {Link} from '@remix-run/react';
import Countdown from 'react-countdown';
import {ClientOnly} from 'remix-utils/client-only';

gql`
  fragment EventDetails on Event {
    id
    name
    description
    start
    end
    poster {
      thumbnail: scaledUri(width: 200)
      large: scaledUri(width: 1200)
      width
      height
      copyright
    }
    bandsPlaying(first: 12) {
      totalCount
      edges {
        node {
          name
        }
      }
    }
    media(first: $num_photos) {
      ...EventPhotos
    }
  }
`;

export default function Event({event}: {event: EventDetailsFragment}) {
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
          src={event.poster.thumbnail}
          original={event.poster.large}
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
            flexDirection="row"
            w="100%"
            bg="brand.900"
            color="white"
            borderRadius="lg"
            boxShadow="lg"
            pt="1"
            px="2"
            pb={['2', '4']}
            maxW="500px"
            mx="auto"
            mt="3"
            mb="3"
            transform="rotate(1deg)"
          >
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
                      <ClientOnly fallback={<>&nbsp;</>}>
                        {() => days}
                      </ClientOnly>
                    </Text>
                    <Text>Tage</Text>
                  </Box>
                  <Box flexBasis={1} flexGrow={1}>
                    <Text
                      fontSize={['xx-large', 'xxx-large']}
                      fontFamily="Shrimp"
                      mb="-3"
                    >
                      <ClientOnly fallback={<>&nbsp;</>}>
                        {() => hours}
                      </ClientOnly>
                    </Text>
                    <Text>Stunden</Text>
                  </Box>
                  <Box flexBasis={1} flexGrow={1}>
                    <Text
                      fontSize={['xx-large', 'xxx-large']}
                      fontFamily="Shrimp"
                      mb="-3"
                    >
                      <ClientOnly fallback={<>&nbsp;</>}>
                        {() => minutes}
                      </ClientOnly>
                    </Text>
                    <Text>Minuten</Text>
                  </Box>
                  <Box flexBasis={1} flexGrow={1}>
                    <Text
                      fontSize={['xx-large', 'xxx-large']}
                      fontFamily="Shrimp"
                      mb="-3"
                    >
                      <ClientOnly fallback={<>&nbsp;</>}>
                        {() => seconds}
                      </ClientOnly>
                    </Text>
                    <Text>Sekunden</Text>
                  </Box>
                </>
              )}
            />
          </Flex>
        )}
        {event.description && <Box>{event.description}</Box>}
        {event.bandsPlaying.totalCount > 0 && (
          <>
            <Heading as="h3" size="md" mb="2">
              Lineup
            </Heading>
            <Box>
              mit {event.bandsPlaying.edges.map((b) => b.node.name).join(', ')}{' '}
              <ChakraLink
                as={Link}
                to={$path('/lineup/:year', {
                  year: event.start.getFullYear(),
                })}
                variant="inline"
              >
                {event.bandsPlaying.totalCount > 12 ? (
                  <>
                    und {event.bandsPlaying.totalCount - 12} weiteren
                    Bands&hellip;
                  </>
                ) : (
                  <>Lineup</>
                )}
              </ChakraLink>
            </Box>
          </>
        )}

        {event.media.edges.length > 0 && (
          <>
            <Heading as="h3" size="md" mt="4" mb="2" id="fotos">
              Fotos
            </Heading>
            <Photos eventId={event.id} media={event.media} />
          </>
        )}
      </Box>
    </Stack>
  );
}
