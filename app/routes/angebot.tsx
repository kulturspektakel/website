import {gql} from '@apollo/client';
import {Text, Heading, List, VStack} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import type {AngebotQuery} from '~/types/graphql';
import {AngebotDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import Page from '~/components/Page';
import {$path} from 'remix-routes';
import LinkButton from '~/components/LinkButton';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query Angebot {
    productLists(activeOnly: true) {
      id
      name
      description
      emoji
    }
    food: node(id: "Page:speisen-getraenke") {
      ... on Page {
        id
        ...PageContent
      }
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

export const meta = mergeMeta<typeof loader>(({data}) => [
  {
    title: 'Angebot & Programm',
  },
  {
    name: 'description',
    content:
      'Essens- und Getränkeangebot, Workshops, Sportturniere und Kinderprogramm',
  },
]);

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<AngebotQuery>({
    query: AngebotDocument,
  });
  return typedjson(data);
}

export default function Angebot() {
  const data = useTypedLoaderData<typeof loader>();
  return (
    <VStack gap="10">
      {data.food && data.food.__typename === 'Page' && (
        <Page {...data.food} centered />
      )}
      <List.Root columnGap="5" columnCount={[1, 2, 3]} m="0" display="block">
        {data.productLists.map((list) => (
          <List.Item
            key={list.id}
            listStyleType="none"
            textAlign="center"
            breakInside="avoid-column"
            mb="5"
          >
            <Text fontSize="lg">{list.emoji}</Text>
            <Heading size="lg">{list.name}</Heading>
            {list.description && <Text mt="1">{list.description}</Text>}
          </List.Item>
        ))}
      </List.Root>
      <LinkButton href={$path('/speisekarte')}>
        vollständige Speisekarte
      </LinkButton>
      {data.workshops && data.workshops.__typename === 'Page' && (
        <Page headingLevel={2} {...data.workshops} centered />
      )}
      {data.sport && data.sport.__typename === 'Page' && (
        <Page headingLevel={2} {...data.sport} centered />
      )}
      {data.kinderkult && data.kinderkult.__typename === 'Page' && (
        <Page headingLevel={2} {...data.kinderkult} centered />
      )}
    </VStack>
  );
}
