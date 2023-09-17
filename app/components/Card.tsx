import type {BoxProps} from '@chakra-ui/react';
import {AspectRatio, Box} from '@chakra-ui/react';
import {Link} from '@remix-run/react';

export default function Card({
  href,
  aspectRatio = 1,
  children,
  preventScrollReset,
  ...props
}: {
  href: string;
  aspectRatio?: number;
  children?: React.ReactNode;
  preventScrollReset?: boolean;
} & BoxProps) {
  return (
    <Link to={href} preventScrollReset={preventScrollReset}>
      <AspectRatio ratio={aspectRatio}>
        <Box
          transition={'transform 0.1s ease-in-out'}
          boxShadow="sm"
          sx={{
            _hover: {transform: 'scale(1.03) rotate(1deg)', boxShadow: 'md'},
          }}
          bgColor="white"
          borderRadius="xl"
          flexDirection="column"
          textAlign="center"
          bgSize="cover"
          bgPos="center"
          p="4"
          {...props}
        >
          {children}
        </Box>
      </AspectRatio>
    </Link>
  );
}
