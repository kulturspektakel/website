import {Text, Link as ChakraLink, Box} from '@chakra-ui/react';
import {useMemo} from 'react';
import {Gallery} from 'react-photoswipe-gallery';
import {Link} from '@tanstack/react-router';
import Image from '../Image';
import {
  immichImageUrl,
  thumbhashToDataUrl,
  type ImmichAsset,
} from '../../utils/immich';

const SIZE = 70;

export default function ImmichPhotos({
  eventId,
  slug,
  assets,
  totalCount,
}: {
  eventId: string;
  slug: string;
  assets: ImmichAsset[];
  totalCount: number;
}) {
  const placeholders = useMemo(
    () =>
      new Map(
        assets.map((asset) => [asset.id, thumbhashToDataUrl(asset.thumbhash)]),
      ),
    [assets],
  );

  return (
    <Box role="grid" display="flex" flexWrap="wrap" gap="2">
      <Gallery options={{loop: false}}>
        {assets.map((asset) => {
          const placeholder = placeholders.get(asset.id);
          return (
            <Image
              key={asset.id}
              original={immichImageUrl(slug, asset.id, 'preview')}
              originalWidth={asset.width}
              originalHeight={asset.height}
              src={immichImageUrl(slug, asset.id, 'thumbnail')}
              objectFit="cover"
              height={SIZE}
              borderRadius="md"
              backgroundImage={placeholder ? `url(${placeholder})` : undefined}
              backgroundSize="cover"
              backgroundPosition="center"
            />
          );
        })}
        {assets.length < totalCount && (
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
            <Link to={'/events/$id'} params={{id: eventId}} hash="fotos">
              <Text fontSize="xl" userSelect="none" mb="-3">
                +{totalCount - assets.length}
              </Text>
              <Text>Fotos</Text>
            </Link>
          </ChakraLink>
        )}
      </Gallery>
    </Box>
  );
}
