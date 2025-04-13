import {gql} from '@apollo/client';
import type {BoxProps} from '@chakra-ui/react';
import {Box} from '@chakra-ui/react';
import type {ArticleFragment} from '../../types/graphql';
import MarkDownWithOverrides from '../MarkdownText';
import DateString from '../DateString';
import Headline from '../Headline';

gql`
  fragment Article on News {
    slug
    title
    createdAt
    content {
      ...MarkdownText
    }
  }
`;

export default function Article({
  data,
  ...props
}: {data: ArticleFragment} & BoxProps) {
  return (
    <Box as="article" {...props}>
      <Headline
        href={`/news/${data.slug}`}
        mark={
          <DateString
            options={{
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }}
            date={data.createdAt}
          />
        }
      >
        {data.title}
      </Headline>
      <Box mt="3">
        <MarkDownWithOverrides markdown={data.content} />
      </Box>
    </Box>
  );
}
