import {HStack, Heading, Text, Link, Box} from '@chakra-ui/react';
import DateString, {dateStringComponents} from '../components/DateString';
import Mark from '../components/Mark';
import {
  FaSpotify,
  FaYoutube,
  FaInstagram,
  FaFacebook,
  FaGlobe,
} from 'react-icons/fa6';
import Image from '../components/Image';
import {Gallery} from 'react-photoswipe-gallery';
import {Tooltip} from '../components/chakra-snippets/tooltip';
import {prismaClient} from '../utils/prismaClient';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {directusImage, DirectusImage, imageUrl} from '../utils/directusImage';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';

const loader = createServerFn()
  .validator((data: {year: string; slug: string}) => data)
  .handler(async ({data}) => {
    const band = await prismaClient.bandPlaying.findUnique({
      where: {
        eventId_slug: {
          eventId: `kult${data.year}`,
          slug: data.slug,
        },
      },
      select: {
        name: true,
        slug: true,
        photo: true,
        startTime: true,
        genre: true,
        spotify: true,
        youtube: true,
        instagram: true,
        facebook: true,
        website: true,
        shortDescription: true,
        description: true,
        Area: {
          select: {
            id: true,
            displayName: true,
            themeColor: true,
          },
        },
      },
    });

    if (!band) {
      throw notFound();
    }

    return {
      ...band,
      photo: await directusImage(band.photo),
    };
  });

export const Route = createFileRoute('/lineup/$year_/$slug')({
  component: LineupBand,
  loader: async ({params}) => await loader({data: params}),
  head: ({params, loaderData}) =>
    loaderData
      ? seo({
          title: `${loaderData.name} | Lineup ${params.year}`,
          description: `${loaderData.genre} · ${
            dateStringComponents({
              date: new Date(loaderData.startTime),
              options: {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              },
            }).date
          } Uhr, ${loaderData.Area.displayName}`,
        })
      : {},
});

function LineupBand() {
  const band = Route.useLoaderData();
  return (
    <Box mt="6">
      {band.photo && (
        <Box
          float="left"
          mr="6"
          mb="4"
          display={['none', 'none', 'block']}
          ms="-10"
        >
          <BandPhoto photo={band.photo} name={band.name} w={400} />
        </Box>
      )}
      <Text>
        <Mark
          bgColor={band.Area.themeColor}
          color={band.Area.id === 'dj' ? 'white' : undefined}
        >
          {band.Area.displayName}
        </Mark>
      </Text>
      <Heading as="h2" size="2xl">
        {band.name}
      </Heading>
      <Text fontWeight="bold">
        <DateString
          options={{
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long',
          }}
          date={band.startTime}
        />
        &nbsp;Uhr
        {band.genre && <>&nbsp;&middot;&nbsp;{band.genre}</>}
      </Text>
      {band.photo && (
        <Box
          display={['block', 'block', 'none']}
          textAlign="center"
          mb="4"
          mt="4"
          w="100%"
        >
          <BandPhoto maxH={300} photo={band.photo} name={band.name} />
        </Box>
      )}
      {(band.spotify ||
        band.youtube ||
        band.instagram ||
        band.facebook ||
        band.website) && (
        <HStack fontSize="28px" gap="6" mt="2">
          {band.spotify && (
            <Tooltip content="Spotify">
              <Link target="_blank" href={band.spotify} color="inherit">
                <FaSpotify />
              </Link>
            </Tooltip>
          )}
          {band.youtube && (
            <Tooltip content="YouTube">
              <Link target="_blank" href={band.youtube} color="inherit">
                <FaYoutube />
              </Link>
            </Tooltip>
          )}
          {band.instagram && (
            <Tooltip content="Instagram">
              <Link target="_blank" href={band.instagram} color="inherit">
                <FaInstagram />
              </Link>
            </Tooltip>
          )}
          {band.facebook && (
            <Tooltip content="Facebook">
              <Link target="_blank" href={band.facebook} color="inherit">
                <FaFacebook />
              </Link>
            </Tooltip>
          )}
          {band.website && (
            <Tooltip content={band.website}>
              <Link target="_blank" href={band.website} color="inherit">
                <FaGlobe />
              </Link>
            </Tooltip>
          )}
        </HStack>
      )}
      <Text mt="4">{band.shortDescription || band.description}</Text>
    </Box>
  );
}

function BandPhoto({
  photo,
  w,
  name,
  maxH,
}: {
  maxH?: number;
  w?: number;
  name: string;
  photo: DirectusImage;
}) {
  return (
    <Gallery withCaption>
      <Image
        src={imageUrl(photo.id)}
        alt={name}
        m="auto"
        caption={photo.copyright ? `Foto: ${photo.copyright}` : undefined}
        maxH={maxH}
        originalHeight={photo.height}
        originalWidth={photo.width}
        original={imageUrl(photo.id, {width: 1600})}
        display="block"
        w={w}
      />
    </Gallery>
  );
}
