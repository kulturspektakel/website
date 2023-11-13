import {gql} from '@apollo/client';
import {Wrap} from '@chakra-ui/react';
import {Gallery, Item} from 'react-photoswipe-gallery';
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
            <Item
              key={m.id}
              original={m.large}
              thumbnail={m.thumbnail}
              width={m.width}
              height={m.height}
            >
              {({ref, open}) => (
                <Image
                  src={m.thumbnail}
                  onClick={open}
                  ref={ref}
                  aspectRatio={1}
                  objectFit="cover"
                  width="70"
                  height="70"
                  borderRadius="md"
                />
              )}
            </Item>
          ))}
      </Gallery>
    </Wrap>
  );
}
