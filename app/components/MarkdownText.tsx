import Markdown from 'markdown-to-jsx';
import type {HeadingProps, ImageProps, LinkProps} from '@chakra-ui/react';
import {
  Text,
  Heading,
  Link as ChakraLink,
  UnorderedList,
  OrderedList,
} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import Image from './Image';
import {Gallery} from 'react-photoswipe-gallery';
import {gql} from '@apollo/client';
import type {MarkdownTextFragment} from '~/types/graphql';

gql`
  fragment MarkdownText on MarkdownString {
    markdown
    images {
      uri
      tiny: scaledUri(width: 250)
      small: scaledUri(width: 900)
      large: scaledUri(width: 1600)
      width
      height
      copyright
    }
  }
`;

type Props = {
  markdown: MarkdownTextFragment;
};

export default function MarkdownText(props: Props) {
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
          p: ({children, ...props}) => (
            <Text mt="2" {...props}>
              {children}
            </Text>
          ),
          a: (props: LinkProps) => (
            <ChakraLink {...props} as={Link} to={props.href} variant="inline" />
          ),
          img: (imgProps: ImageProps) => {
            const img = props.markdown.images.find(
              (image) => image.uri === imgProps.src,
            );

            if (!img) {
              return null;
            }
            return (
              <Gallery>
                <Image
                  mt="3"
                  mb="3"
                  ml="auto"
                  mr="auto"
                  bgColor="white"
                  originalHeight={img.height}
                  originalWidth={img.width}
                  maxH={500}
                  src={img.small}
                  original={img.large}
                  caption={img.copyright ? `Foto: ${img.copyright}` : undefined}
                />
              </Gallery>
            );
          },
          ul: UnorderedList,
          ol: OrderedList,
        },
      }}
    >
      {props.markdown.markdown}
    </Markdown>
  );
}
