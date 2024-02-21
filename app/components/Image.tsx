import Card from '~/components/Card';
import type {ImageProps} from '@chakra-ui/react';
import {Image as ChakraImage} from '@chakra-ui/react';
import type {ItemProps} from 'react-photoswipe-gallery';
import {Item} from 'react-photoswipe-gallery';

export default function Image({
  original,
  originalWidth,
  originalHeight,
  cropped,
  maxH,
  ...props
}: ImageProps & {
  maxH?: number;
  maxHeight?: never;
  original: string;
  originalWidth?: number;
  originalHeight?: number;
} & Omit<ItemProps<HTMLDivElement>, 'width' | 'height' | 'children'>) {
  return (
    <Item
      original={original}
      thumbnail={props.src}
      width={originalWidth}
      height={originalHeight}
      caption={props.caption ?? props.alt}
      cropped={cropped}
    >
      {({ref, open}) => (
        <Card
          {...props}
          aria-label="Bild vergrößern"
          role="button"
          aria-haspopup="dialog"
          onClick={open}
          htmlHeight={maxH}
          htmlWidth={
            maxH != null && originalWidth != null && originalHeight != null
              ? (originalWidth / originalHeight) * maxH
              : undefined
          }
          aspectRatio={
            props.aspectRatio == null &&
            originalWidth != null &&
            originalHeight != null
              ? originalWidth / originalHeight
              : undefined
          }
          as={ChakraImage}
          title={props.caption}
          ref={ref}
          loading="lazy"
        />
      )}
    </Item>
  );
}
