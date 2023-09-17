import type {BoxProps} from '@chakra-ui/react';
import {AspectRatio, Box} from '@chakra-ui/react';
import {Link} from '@remix-run/react';

export default function Card({
  href,
  aspectRatio = 1,
  children,
  ...props
}: {
  href: string;
  aspectRatio?: number;
  children?: React.ReactNode;
} & BoxProps) {
  return (
    <Link to={href}>
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
