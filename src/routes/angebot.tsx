import {Text, Heading, List, VStack} from '@chakra-ui/react';
import Page from '../components/Page';
import LinkButton from '../components/LinkButton';
import {createFileRoute} from '@tanstack/react-router';
import {loader} from '../server/routes/angebot';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/angebot')({
  component: Angebot,
  loader: async () => await loader(),
  head: () =>
    seo({
      title: 'Angebot & Programm',
      description:
        'Essens- und Getränkeangebot, Workshops, Sportturniere und Kinderprogramm',
    }),
});

export default function Angebot() {
  const data = Route.useLoaderData();

  return (
    <VStack gap="10">
      {data['speisen-getraenke'] && (
        <Page {...data['speisen-getraenke']} centered />
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
            {list.description && (
              <Text mt="1" hyphens="auto">
                {list.description}
              </Text>
            )}
          </List.Item>
        ))}
      </List.Root>
      <LinkButton linkOptions={{to: '/speisekarte'}}>
        vollständige Speisekarte
      </LinkButton>
      {data.workshops && <Page headingLevel={2} {...data.workshops} centered />}
      {data.sport && <Page headingLevel={2} {...data.sport} centered />}
      {data.kinderkult && (
        <Page headingLevel={2} {...data.kinderkult} centered />
      )}
    </VStack>
  );
}
