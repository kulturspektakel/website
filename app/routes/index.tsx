import {Center, Separator} from '@chakra-ui/react';
import {gql} from '@apollo/client';
import React from 'react';
import Article from '../components/news/Article';
import LinkButton from '../components/LinkButton';
import {useNewsSuspenseQuery} from '../types/graphql';
import {createFileRoute} from '@tanstack/react-router';

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

export const Route = createFileRoute('/')({
  component: Index,
});

export function Index() {
  const {data} = useNewsSuspenseQuery();

  return (
    <>
      {data?.news.edges.slice(0, 8).map((edge, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Separator width="60%" m="auto" mb="16" />}
          <Article key={edge.node.slug} data={edge.node} mb="12" />
        </React.Fragment>
      ))}
      <Center>
        <LinkButton href="/news/archiv">Ältere Beträge</LinkButton>
      </Center>
    </>
  );
}
