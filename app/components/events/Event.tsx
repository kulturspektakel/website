import {Box, Heading, Stack, Link as ChakraLink} from '@chakra-ui/react';
import {Item} from 'react-photoswipe-gallery';
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
    poster {
      thumbnail: scaledUri(width: 200)
      large: scaledUri(width: 1200)
      width
      height
      copyright
    }
    bandsPlaying {
      totalCount
      edges {
        node {
          name
        }
      }
    }
    media(first: 100) {
      ...EventPhotos
    }
  }
`;

export default function Event({event}: {event: EventDetailsFragment}) {
  return (
    <Stack
      direction={['column', 'row']}
      spacing="5"
      mt="5"
      align={['center', 'flex-start']}
    >
      {event.poster && (
        <Item
          original={event.poster.large}
          thumbnail={event.poster.thumbnail}
          width={event.poster.width}
          height={event.poster.height}
          caption={event.poster.copyright ?? undefined}
          key={event.id}
        >
          {({ref, open}) => (
            <Image
              onClick={open}
              w="200px"
              ref={ref as React.MutableRefObject<HTMLImageElement>}
              src={event.poster!.thumbnail}
              role="link"
              tabIndex={0}
              alt={`Poster von ${event.name}`}
              onKeyDown={(e) => e?.key === 'Enter' && open(e)}
            />
          )}
        </Item>
      )}
      <Box>
        {event.description && <Box>{event.description}</Box>}
        {event.bandsPlaying.totalCount > 0 && (
          <>
            <Heading as="h3" size="md" mb="2">
              Lineup
            </Heading>
            <Box>
              {event.bandsPlaying.edges.map((b) => b.node.name).join(', ')}
              <ChakraLink
                color="brand.500"
                as={Link}
                to={$path('/lineup/:year', {
                  year: event.start.getFullYear(),
                })}
              >
                Lineup
              </ChakraLink>
            </Box>
          </>
        )}
        {event.media.edges.length > 0 && (
          <>
            <Heading as="h3" size="md" mt="4" mb="2">
              Fotos
            </Heading>
            <Photos media={event.media} />
          </>
        )}
      </Box>
    </Stack>
  );
}
