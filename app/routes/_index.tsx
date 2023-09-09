import {Box, Button, Center, Divider, Link} from '@chakra-ui/react';
import {gql} from '@apollo/client';
import {NewsDocument, type NewsQuery} from '~/types/graphql';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import React from 'react';
import Article from '~/components/Article';
import apolloClient from '~/utils/apolloClient';
import {type LoaderArgs} from '@remix-run/node';

gql`
  query News {
    news(first: 10) {
      edges {
        node {
          ...Article
        }
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<NewsQuery>({
    query: NewsDocument,
  });
  return typedjson(data);
}

export default function Index() {
  const data = useTypedLoaderData<typeof loader>();

  return (
    <Box ml="auto" mr="auto" maxW="3xl" p="6">
      {data.news.edges.slice(0, 8).map((edge, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Divider width="60%" m="auto" />}
          <Article key={edge.node.slug} {...edge.node} />
        </React.Fragment>
      ))}
      <Center>
        <Button href="/news/archiv" as={Link}>
          Ältere Beträge
        </Button>
      </Center>
    </Box>
  );
}
