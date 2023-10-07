import {gql} from '@apollo/client';
import {Box} from '@chakra-ui/react';
import type {ArticleFragment} from '../../types/graphql';
import ArticleHead from './ArticleHead';
import MarkDownWithOverrides from '../MarkDownWithOverrides';

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
        <MarkDownWithOverrides>{props.content}</MarkDownWithOverrides>
      </Box>
    </Box>
  );
}
