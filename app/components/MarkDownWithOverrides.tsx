import Markdown from 'markdown-to-jsx';
import type {HeadingProps, LinkProps} from '@chakra-ui/react';
import {Text, Heading, Image, Link as ChakraLink} from '@chakra-ui/react';
import {Link} from '@remix-run/react';

export default function MarkDownWithOverrides(props: any) {
  return (
    <Markdown
      options={{
        overrides: {
          h1: (props: HeadingProps) => (
            <Heading {...props} size="md" as="h2" mb={3} mt={5} />
          ),
          h2: (props: HeadingProps) => (
            <Heading {...props} size="md" as="h3" mb={2} mt={4} />
          ),
          h3: (props: HeadingProps) => (
            <Heading {...props} size="sm" as="h4" mb={1} mt={3} />
          ),
          h4: (props: HeadingProps) => (
            <Heading {...props} size="sm" as="h5" mb={1} mt={3} />
          ),
          h5: (props: HeadingProps) => (
            <Heading {...props} size="sm" as="h6" mb={1} mt={3} />
          ),
          h6: (props: HeadingProps) => (
            <Heading {...props} size="sm" as="h6" mb={1} mt={3} />
          ),
          p: Text,
          a: (props: LinkProps) => (
            <ChakraLink
              {...props}
              as={Link}
              to={props.href}
              color="brand.500"
            />
          ),
          img: ({src, ...props}) => {
            const scaledSrc = new URL(src);
            scaledSrc.searchParams.set('width', '900');

            return (
              <Image
                maxH="500px"
                borderRadius="xl"
                transform="rotate(-1deg)"
                boxShadow="lg"
                mt="3"
                mb="3"
                ml="auto"
                mr="auto"
                loading="lazy"
                transition="transform 0.1s ease-in-out"
                _hover={{transform: 'rotate(1deg)'}}
                src={scaledSrc}
                {...props}
              />
            );
          },
        },
      }}
    >
      {props.children}
    </Markdown>
  );
}
