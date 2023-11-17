import {gql} from '@apollo/client';
import {Text, Heading, ListItem, UnorderedList, VStack} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import type {AngebotQuery} from '~/types/graphql';
import {AngebotDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import Page from '~/components/Page';

gql`
  query Angebot {
    productLists(activeOnly: true) {
      id
      name
      description
      emoji
    }
    workshops: node(id: "Page:workshops") {
      ... on Page {
        id
        ...PageContent
      }
    }
    sport: node(id: "Page:sport") {
      ... on Page {
        id
        ...PageContent
      }
    }
    kinderkult: node(id: "Page:kinderkult") {
      ... on Page {
        id
        ...PageContent
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<AngebotQuery>({
    query: AngebotDocument,
  });
  return typedjson({data});
}

export default function Angebot() {
  const {data} = useTypedLoaderData<typeof loader>();
  return (
    <VStack spacing="10">
      <Heading textAlign="center">Speisen & Getränke</Heading>
      <UnorderedList columnGap="5" sx={{columnCount: [1, 2, 3]}}>
        {data.productLists.map((list) => (
          <ListItem
            key={list.id}
            listStyleType="none"
            textAlign="center"
            sx={{breakInside: 'avoid-column'}}
            mb="5"
          >
            <Text fontSize="lg">{list.emoji}</Text>
            <Heading size="md">{list.name}</Heading>
            {list.description && <Text mt="1">{list.description}</Text>}
          </ListItem>
        ))}
      </UnorderedList>
      {data.workshops && data.workshops.__typename === 'Page' && (
        <Page {...data.workshops} centered />
      )}
      {data.sport && data.sport.__typename === 'Page' && (
        <Page {...data.sport} centered />
      )}
      {data.kinderkult && data.kinderkult.__typename === 'Page' && (
        <Page {...data.kinderkult} centered />
      )}
    </VStack>
  );
}
