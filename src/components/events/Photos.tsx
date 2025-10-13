import {Text, Link as ChakraLink, Box} from '@chakra-ui/react';
import type PhotoSwipe from 'photoswipe';
import {useCallback, useRef} from 'react';
import {Gallery} from 'react-photoswipe-gallery';
import Image from '../Image';
import {Link} from '@tanstack/react-router';
import {
  DirectusImage,
  directusImageConnection,
  imageUrl,
} from '../../utils/directusImage';
import {createServerFn, useServerFn} from '@tanstack/react-start';
import {DataSourceArray} from 'photoswipe';

const SIZE = 70;

const loadMoreImages = createServerFn()
  .inputValidator(
    (params: {limit: number; offset: number; eventId: string}) => params,
  )
  .handler(async ({data: {eventId, offset, limit}}) => {
    return await directusImageConnection('Event', eventId, limit, offset);
  });

export default function EventComponent({
  files,
  totalCount,
  eventId,
}: {
  files: DirectusImage[];
  totalCount: number;
  eventId: string;
}) {
  const onLoadMoreImages = useServerFn(loadMoreImages);
  const inflightRequests = useRef(new Map<number, Promise<any>>());
  const onBeforeOpen = useCallback(
    async (pswp: PhotoSwipe) => {
      pswp.addFilter('numItems', () => totalCount);

      pswp.addFilter('itemData', (itemData, index) => {
        if (itemData.src) {
          return itemData;
        }

        const limit = files.length;
        const page = Math.floor((index + 1) / limit);
        const offset = page * limit;

        if (inflightRequests.current.has(page)) {
          return {};
        }

        inflightRequests.current.set(
          page,
          onLoadMoreImages({
            data: {
              eventId,
              offset,
              limit,
            },
          }).then((data) => {
            data.files.forEach((image, i) => {
              (pswp.options.dataSource as DataSourceArray)[offset + i] = {
                w: image.width,
                h: image.height,
                msrc: imageUrl(image.id, {height: SIZE}),
                src: imageUrl(image.id, {width: 1600}),
              };
              pswp.refreshSlideContent(offset + i);
            });
            inflightRequests.current.delete(page);
          }),
        );
        return {};
      });
    },

    [eventId, files, totalCount, onLoadMoreImages],
  );

  return (
    <Box role="grid" display="flex" flexWrap="wrap" gap="2">
      <Gallery options={{loop: false}} onBeforeOpen={onBeforeOpen}>
        {files.map((m) => (
          <Image
            key={m.id}
            original={imageUrl(m.id, {width: 1600})}
            originalWidth={m.width}
            originalHeight={m.height}
            src={imageUrl(m.id, {height: SIZE})}
            objectFit="cover"
            height={SIZE}
            borderRadius="md"
          />
        ))}
        {files.length < totalCount && (
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
              to={'/events/$id'}
              params={{
                id: eventId,
              }}
            >
              <Text fontSize="xl" userSelect="none" mb="-3">
                +{totalCount - files.length}
              </Text>
              <Text>Fotos</Text>
            </Link>
          </ChakraLink>
        )}
      </Gallery>
    </Box>
  );
}
