import {gql} from '@apollo/client';
import {Text, Link as ChakraLink, Box} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import type PhotoSwipe from 'photoswipe';
import {useCallback} from 'react';
import {Gallery} from 'react-photoswipe-gallery';
import {$path} from 'remix-routes';
import Image from '~/components/Image';
import {
  type EventPhotosFragment,
  type MorePhotosQuery,
  MorePhotosDocument,
} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';

gql`
  fragment EventPhotos on EventMediaConnection {
    totalCount
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        ... on PixelImage {
          width
          height
          thumbnail: scaledUri(width: 140)
          large: scaledUri(width: 1200)
        }
      }
    }
  }

  query MorePhotos($event: ID!, $cursor: String) {
    node(id: $event) {
      ... on Event {
        media(after: $cursor, first: 100) {
          ...EventPhotos
        }
      }
    }
  }
`;

const SIZE = 70;

export default function EventComponent({
  media,
  eventId,
}: {
  media: EventPhotosFragment;
  eventId: string;
}) {
  const onBeforeOpen = useCallback(
    async (pswp: PhotoSwipe) => {
      pswp.addFilter('numItems', () => media.totalCount);

      const {data} = await apolloClient.query<MorePhotosQuery>({
        query: MorePhotosDocument,
        fetchPolicy: 'cache-first',
        variables: {
          event: eventId,
          cursor: media.edges[media.edges.length - 1]?.cursor,
        },
      });

      const event = data.node?.__typename === 'Event' ? data.node : null;
      if (!event) {
        return;
      }

      pswp.addFilter('itemData', (itemData, index) => {
        if (!itemData.src) {
          const {
            width: w,
            height: h,
            thumbnail: msrc,
            large: src,
          } = event.media.edges[index - media.edges.length].node;
          return {
            w,
            h,
            msrc,
            src,
          };
        }
        return itemData;
      });
    },
    [eventId, media.edges, media.totalCount],
  );

  return (
    <Box role="grid">
      <Gallery options={{loop: false}} onBeforeOpen={onBeforeOpen}>
        {media.edges
          .map((m) => m.node)
          .map((m) => (
            <Image
              key={m.id}
              original={m.large}
              originalWidth={m.width}
              originalHeight={m.height}
              src={m.thumbnail}
              objectFit="cover"
              height={SIZE}
              borderRadius="md"
            />
          ))}
        {media.pageInfo.hasNextPage && (
          <ChakraLink
            asChild
            height={SIZE}
            width={SIZE}
            borderRadius="md"
            justifyContent="center"
            alignItems="center"
            display="flex"
            flexDirection="column"
            color="brand.900"
            fontWeight="bold"
          >
            <Link
              to={$path('/events/:id', {id: eventId.split(':')[1]}) + '#fotos'}
            >
              <Text fontSize="xl" userSelect="none" mb="-3">
                +{media.totalCount - media.edges.length}
              </Text>
              <Text>Fotos</Text>
            </Link>
          </ChakraLink>
        )}
      </Gallery>
    </Box>
  );
}
