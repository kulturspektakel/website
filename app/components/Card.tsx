import type {BoxProps} from '@chakra-ui/react';
import {AspectRatio, Box, Image} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import type {Property} from 'csstype';

export default function Card({
  href,
  aspectRatio = 1,
  children,
  preventScrollReset,
  image,
  imageBlendMode,
  ...props
}: {
  image?: string;
  imageBlendMode?: Property.MixBlendMode;
  href: string;
  aspectRatio?: number;
  children?: React.ReactNode;
  preventScrollReset?: boolean;
} & BoxProps) {
  return (
    <Link to={href} preventScrollReset={preventScrollReset}>
      <AspectRatio
        ratio={aspectRatio}
        borderRadius="xl"
        overflow="hidden"
        transition="transform 0.1s ease-in-out"
        _hover={{
          transform: 'scale(1.03) rotate(1deg)',
          boxShadow: 'md',
        }}
        boxShadow="sm"
        {...props}
      >
        <>
          {image && (
            <Image
              blendMode={imageBlendMode}
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              objectFit="cover"
              src={image}
              loading="lazy"
            />
          )}
          <Box
            aspectRatio={aspectRatio}
            flexDirection="column"
            textAlign="center"
          >
            {children}
          </Box>
        </>
      </AspectRatio>
    </Link>
  );
}
