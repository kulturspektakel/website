import {Image, Center, BoxProps} from '@chakra-ui/react';
import {FaSpotify} from 'react-icons/fa6';

export function SpotifyCover({
  image,
  ...props
}: {image?: string | null; width: string} & BoxProps) {
  if (!image) {
    return (
      <Center aspectRatio={1} borderRadius="md" bg="offwhite.200" {...props}>
        <FaSpotify color="white" />
      </Center>
    );
  }
  return (
    <Image
      src={image ?? undefined}
      aspectRatio={1}
      objectFit="cover"
      borderRadius="md"
      {...props}
    />
  );
}
