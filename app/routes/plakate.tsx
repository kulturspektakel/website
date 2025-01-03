import {gql} from '@apollo/client';
import {Heading, Link, SimpleGrid, VStack} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {Gallery} from 'react-photoswipe-gallery';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import {Alert} from '~/components/chakra-snippets/alert';
import Image from '~/components/Image';
import type {PlakateQuery} from '~/types/graphql';
import {PlakateDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query Plakate {
    eventsConnection(type: Kulturspektakel, first: 50) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          name
          start
          poster {
            small: scaledUri(width: 200)
            large: scaledUri(width: 1600)
            width
            height
            copyright
          }
        }
      }
    }
  }
`;

export const meta = mergeMeta<typeof loader>(({data, params}) => {
  return [
    {
      title: 'Plakate',
    },
    {
      name: 'description',
      content: 'Übersicht aller Kulturspektakel Plakate',
    },
  ];
});

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<PlakateQuery>({
    query: PlakateDocument,
  });

  return typedjson(data);
}

export default function Plakate() {
  const data = useTypedLoaderData<typeof loader>();
  return (
    <VStack gap="10">
      <Heading as="h1" textAlign="center" size="3xl">
        Plakate
      </Heading>
      <Gallery options={{loop: false}} withCaption>
        <SimpleGrid columns={[2, 3, 4]} gap={5}>
          {data.eventsConnection.edges.map(({node}) =>
            node.poster ? (
              <Image
                key={node.id}
                original={node.poster.large}
                src={node.poster.small}
                alt={node.name}
                originalHeight={node.poster.height}
                originalWidth={node.poster.width}
                caption={`Kulturspektakel ${node.start.getFullYear()} · Gestaltung: ${
                  node.poster?.copyright ?? 'unbekannt'
                }`}
              />
            ) : null,
          )}
        </SimpleGrid>
        <Alert title="Fehlende Plakate?">
          Falls du ein Plakat hast, das hier noch fehlt, schick es uns gerne an{' '}
          <Link href="mailto:info@kulturspektakel.de?subject=Fehlendes Plakat">
            info@kulturspektakel.de
          </Link>
        </Alert>
      </Gallery>
    </VStack>
  );
}
