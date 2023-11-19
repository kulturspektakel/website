import {Box, Heading, Stack, Link as ChakraLink, Text} from '@chakra-ui/react';
import {$path} from 'remix-routes';
import {gql} from '@apollo/client';
import Image from '~/components/Image';
import Photos from '~/components/events/Photos';
import type {EventDetailsFragment} from '~/types/graphql';
import {Link} from '@remix-run/react';

gql`
  fragment EventDetails on Event {
    id
    name
    description
    start
    end
    bandApplicationStart
    bandApplicationEnd
    djApplicationStart
    djApplicationEnd
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

function applicationsOpen(event: EventDetailsFragment) {
  return (
    (event.bandApplicationStart &&
      event.bandApplicationEnd &&
      event.bandApplicationStart.getTime() < Date.now() &&
      event.bandApplicationEnd.getTime() > Date.now()) ||
    (event.djApplicationStart &&
      event.djApplicationEnd &&
      event.djApplicationStart.getTime() < Date.now() &&
      event.djApplicationEnd.getTime() > Date.now())
  );
}

export default function Event({event}: {event: EventDetailsFragment}) {
  const applications = applicationsOpen(event);
  return (
    <Stack
      direction={['column', 'row']}
      spacing="5"
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
      <Box>
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
        {applications && (
          <>
            <Heading as="h3" size="md" mb="2">
              Booking
            </Heading>
            <Text>
              Die Bewerbungsphase läuft aktuell und ihr könnt euch jetzt für
              einen Auftritt bei uns{' '}
              <ChakraLink as={Link} to={$path('/booking')} variant="inline">
                bewerben
              </ChakraLink>
              .
            </Text>
          </>
        )}
        {event.media.edges.length > 0 && (
          <>
            <Heading as="h3" size="md" mt="4" mb="2">
              Fotos
            </Heading>
            <Photos eventId={event.id} media={event.media} />
          </>
        )}
      </Box>
    </Stack>
  );
}
