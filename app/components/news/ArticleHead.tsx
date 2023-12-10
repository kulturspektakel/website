import {gql} from '@apollo/client';
import {Heading, Link as ChakraLink} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import DateString from '../DateString';
import Mark from '../Mark';
import type {ArticleHeadFragment} from '../../types/graphql';
import {$path} from 'remix-routes';

gql`
  fragment ArticleHead on News {
    slug
    title
    createdAt
  }
`;

export default function ArticleHead(props: ArticleHeadFragment) {
  return (
    <>
      <Heading size="lg" mb="1">
        <ChakraLink as={Link} to={$path('/news/:slug', {slug: props.slug})}>
          {props.title}
        </ChakraLink>
      </Heading>
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
    </>
  );
}
