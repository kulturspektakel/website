import Markdown from 'markdown-to-jsx';
import type {HeadingProps, ImageProps, LinkProps} from '@chakra-ui/react';
import {
  Text,
  Heading,
  Link as ChakraLink,
  ListRoot,
  ListItem,
} from '@chakra-ui/react';
import Image from './Image';
import {Gallery} from 'react-photoswipe-gallery';
import {Link} from '@tanstack/react-router';
import {imageUrl} from '../utils/directusImage';
import {Markdown as MarkdownT} from '../utils/markdownText';

export default function MarkdownText(props: MarkdownT) {
  return (
    <Markdown
      options={{
        tagfilter: false,
        overrides: {
          h1: (props: HeadingProps) => (
            <Heading {...props} size="2xl" as="h2" mb={3} mt={5} />
          ),
          h2: (props: HeadingProps) => (
            <Heading {...props} size="xl" as="h3" mb={2} mt={4} />
          ),
          h3: (props: HeadingProps) => (
            <Heading {...props} size="md" as="h4" mb={1} mt={3} />
          ),
          h4: (props: HeadingProps) => (
            <Heading {...props} size="md" as="h5" mb={1} mt={3} />
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
            <ChakraLink {...props} asChild>
              <Link to={props.href!}>{props.children}</Link>
            </ChakraLink>
          ),
          img: (imgProps: ImageProps) => {
            const img = props.images.find(
              (image) => imageUrl(image.id) === imgProps.src,
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
                  src={imageUrl(img.id, {width: 720})}
                  original={imageUrl(img.id, {width: 1600})}
                  caption={img.copyright ? `Foto: ${img.copyright}` : undefined}
                />
              </Gallery>
            );
          },
          ul: (props) => (
            <ListRoot mt="2" ps="5" listStylePos="outside" {...props} />
          ),
          ol: (props) => (
            <ListRoot ps="5" listStylePos="outside" as="ol" {...props} />
          ),
          li: (props) => <ListItem ps="0.5" mb="1" {...props} />,
        },
      }}
    >
      {props.markdown}
    </Markdown>
  );
}
