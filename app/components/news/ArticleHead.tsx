import { gql } from '@apollo/client';
import { Heading } from '@chakra-ui/react';
import DateString from '../DateString';
import Mark from '../Mark';
import type { ArticleHeadFragment } from '../../types/graphql';

gql`
  fragment ArticleHead on News {
    slug
    title
    createdAt
  }
`;

export default function ArticleHead(props: ArticleHeadFragment) {
  return (
    <a href={`/news/${props.slug}`}>
      <Heading size="lg" mb="2">{props.title}</Heading>
      <Mark>
        <DateString
          options={{
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }}
          date={props.createdAt}
        />
      </Mark>
    </a>
  );
}
