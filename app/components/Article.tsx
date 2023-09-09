import {gql} from '@apollo/client';
import type {ArticleFragment} from '../types/graphql';
import Markdown from 'markdown-to-jsx';
import {
  Text,
  Heading,
  Box,
  HeadingProps,
  Link as ChakraLink,
  LinkProps,
} from '@chakra-ui/react';
import ArticleHead from './ArticleHead';
import {Link} from '@remix-run/react';

gql`
  fragment Article on News {
    slug
    title
    createdAt
    content
    ...ArticleHead
  }
`;

export default function Article(props: ArticleFragment) {
  return (
    <Box as="article" mb="10" mt="10">
      <ArticleHead
        title={props.title}
        createdAt={props.createdAt}
        slug={props.slug}
      />
      <Box mt="3">
        <Markdown
          options={{
            overrides: {
              h1: (props: HeadingProps) => (
                <Heading {...props} size="md" as="h3" />
              ),
              h2: (props: HeadingProps) => (
                <Heading {...props} size="md" as="h3" />
              ),
              h3: (props: HeadingProps) => (
                <Heading {...props} size="sm" as="h3" />
              ),
              h4: (props: HeadingProps) => (
                <Heading {...props} size="sm" as="h4" />
              ),
              h5: (props: HeadingProps) => (
                <Heading {...props} size="sm" as="h5" />
              ),
              h6: (props: HeadingProps) => (
                <Heading {...props} size="sm" as="h6" />
              ),
              p: Text,
              a: (props: LinkProps) => (
                <ChakraLink {...props} as={Link} to={props.href} />
              ),
              img: (props) => null,
              // <Image src={props.src ?? ''} alt={props.alt ?? props.title ?? ''} />
            },
          }}
        >
          {props.content}
        </Markdown>
      </Box>
    </Box>
  );
}
