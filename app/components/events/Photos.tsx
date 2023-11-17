import {gql} from '@apollo/client';
import {Wrap} from '@chakra-ui/react';
import {Gallery} from 'react-photoswipe-gallery';
import Image from '~/components/Image';
import type {EventPhotosFragment} from '~/types/graphql';

gql`
  fragment EventPhotos on EventMediaConnection {
    totalCount
    edges {
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
`;

export default function EventComponent({media}: {media: EventPhotosFragment}) {
  return (
    <Wrap role="grid">
      <Gallery>
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
              height="70"
              borderRadius="md"
            />
          ))}
      </Gallery>
    </Wrap>
  );
}
