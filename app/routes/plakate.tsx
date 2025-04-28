import {Heading, Link, SimpleGrid, VStack} from '@chakra-ui/react';
import {createFileRoute} from '@tanstack/react-router';
import {Gallery} from 'react-photoswipe-gallery';
import {Alert} from '../components/chakra-snippets/alert';
import Image from '../components/Image';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {directusImages, imageUrl} from '../utils/directusImage';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/plakate')({
  component: Plakate,
  loader: async () => await loader(),
  head: () =>
    seo({
      title: 'Plakate',
      description: 'Übersicht aller Kulturspektakel Plakate',
    }),
});

const loader = createServerFn().handler(async ({data: slug}) => {
  const data = await prismaClient.event.findMany({
    where: {
      eventType: 'Kulturspektakel',
    },
    orderBy: {
      start: 'desc',
    },
    select: {
      id: true,
      name: true,
      start: true,
      poster: true,
    },
  });

  const images = await directusImages(data.map((event) => event.poster));
  return data.map(({poster, ...data}) => ({
    ...data,
    poster: poster ? images[poster] : null,
  }));
});

export default function Plakate() {
  const data = Route.useLoaderData();
  return (
    <VStack gap="10">
      <Heading as="h1" textAlign="center" size="3xl">
        Plakate
      </Heading>
      <Gallery options={{loop: false}} withCaption>
        <SimpleGrid columns={[2, 3, 4]} gap={5}>
          {data.map((event) =>
            event.poster ? (
              <Image
                key={event.id}
                original={imageUrl(event.poster.id, {width: 1600})}
                src={imageUrl(event.poster.id, {width: 200})}
                alt={event.name}
                originalHeight={event.poster.height}
                originalWidth={event.poster.width}
                caption={`Kulturspektakel ${event.start.getFullYear()} · Gestaltung: ${
                  event.poster?.copyright ?? 'unbekannt'
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
