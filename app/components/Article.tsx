import {gql} from '@apollo/client';
import type {ArticleFragment} from '../types/graphql';
import Markdown from 'markdown-to-jsx';
import {Text, Heading, Box} from '@chakra-ui/react';
import ArticleHead from './ArticleHead';

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
        {/* <Markdown
          components={{
            h1: Heading,
            h2: Heading,
            p: Text,
            // img: (props) => null,
            // <Image src={props.src ?? ''} alt={props.alt ?? props.title ?? ''} />
          }}
        >
          {props.content}
        </Markdown> */}
      </Box>
    </Box>
  );
}
