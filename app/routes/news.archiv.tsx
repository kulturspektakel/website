import {gql} from '@apollo/client';
import {
  Box,
  Heading,
  SimpleGrid,
  Image,
  Center,
  Button,
} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import React from 'react';
import {typedjson} from 'remix-typedjson';
import Card from '~/components/Card';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';
import {NewsArchiveDocument, useNewsArchiveQuery} from '~/types/graphql';
import type {NewsArchiveQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query NewsArchive($cursor: String) {
    news(after: $cursor, first: 20) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          ...Article
        }
      }
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<NewsArchiveQuery>({
    query: NewsArchiveDocument,
    variables: {
      id: `News:${args.params.slug}`,
    },
  });
  return typedjson(data);
}

export const meta = mergeMeta<typeof loader>(({data}) => [
  {
    title: 'Newsarchiv',
  },
]);

export default function NewsArchive() {
  const {data, fetchMore, loading} = useNewsArchiveQuery({
    notifyOnNetworkStatusChange: true,
  });

  // group data by year
  const years =
    data?.news.edges.reduce((acc, edge) => {
      const year = edge.node.createdAt.getFullYear();
      if (acc.has(year)) {
        acc.get(year)?.push(edge);
      } else {
        acc.set(year, [edge]);
      }
      return acc;
    }, new Map<number, typeof data.news.edges>()) ?? [];

  return (
    <>
      {Array.from(years.entries())
        .sort(([a], [b]) => b - a)
        .map(([year, edges]) => (
          <React.Fragment key={year}>
            <Heading textAlign="center" mb="10">
              {year}
            </Heading>
            <SimpleGrid columns={[2, 2, 3]} spacing={4} key={year} mb="10">
              {edges.map(({node}, i) => (
                <Card
                  key={node.slug}
                  href={`/news/${node.slug}`}
                  aspectRatio={1}
                  bgSize="cover"
                  bgPosition="center"
                >
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    p="4"
                    bgImage={
                      node.content.images[0]?.uri
                        ? 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.3))'
                        : undefined
                    }
                    zIndex={2}
                  >
                    <Mark ml="0.5">
                      <DateString date={node.createdAt} />
                    </Mark>
                    <Heading
                      size={['md', 'lg', 'lg']}
                      color={node.content.images[0]?.uri ? 'white' : undefined}
                      mt="1"
                      noOfLines={5}
                    >
                      {node.title}
                    </Heading>
                  </Box>
                  <Image
                    position="absolute"
                    width="100%"
                    height="100%"
                    src={node.content.images[0]?.tiny}
                    loading="lazy"
                    objectFit="cover"
                  />
                </Card>
              ))}
            </SimpleGrid>
          </React.Fragment>
        ))}
      {data?.news.pageInfo.hasNextPage && (
        <Center p="10">
          <Button
            onClick={() =>
              fetchMore({
                variables: {
                  cursor: data?.news.edges[data.news.edges.length - 1].cursor,
                },
                updateQuery: ({news}, {fetchMoreResult}) => ({
                  news: {
                    ...fetchMoreResult.news,
                    edges: [...news.edges, ...fetchMoreResult.news.edges],
                  },
                }),
              })
            }
            isLoading={loading}
          >
            ältere Artikel
          </Button>
        </Center>
      )}
    </>
  );
}
