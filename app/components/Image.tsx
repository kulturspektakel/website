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
  ...props
}: ImageProps & {
  originalWidth?: number;
  originalHeight?: number;
} & Omit<ItemProps, 'width' | 'height' | 'children'>) {
  if (original != null) {
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
            onClick={open}
            aspectRatio={
              props.aspectRatio == null && originalWidth && originalHeight
                ? originalWidth / originalHeight
                : undefined
            }
            as={ChakraImage}
            title={props.caption}
            loading="lazy"
            ref={ref}
          />
        )}
      </Item>
    );
  }
  return <Card {...props} as={ChakraImage} loading="lazy" />;
}
