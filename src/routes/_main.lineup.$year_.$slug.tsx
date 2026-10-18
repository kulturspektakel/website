import {HStack, Heading, Text, Link, Box, Separator} from '@chakra-ui/react';
import DateString, {dateStringComponents} from '../components/DateString';
import Mark from '../components/Mark';
import {
  FaSpotify,
  FaYoutube,
  FaInstagram,
  FaFacebook,
  FaGlobe,
  FaSoundcloud,
} from 'react-icons/fa6';
import Image from '../components/Image';
import {Gallery} from 'react-photoswipe-gallery';
import {Tooltip} from '../components/chakra-snippets/tooltip';
import {
  createFileRoute,
  Link as RouterLink,
  notFound,
} from '@tanstack/react-router';
import {DirectusImage, imageUrl} from '../utils/directusImage';
import {createServerFn} from '@tanstack/react-start';
import {and, asc, desc, eq, gt, lt} from 'drizzle-orm';
import {db} from '../server/db.server';
import {bandPlaying} from '../server/db/schema';
import {directusImage} from '../server/directusImage.server';
import {isSameDay} from '../utils/dateUtils';
import {seo} from '../utils/seo';

const loader = createServerFn()
  .validator((data: {year: string; slug: string}) => data)
  .handler(async ({data}) => {
    const eventId = `kult${data.year}`;
    const band = await db.query.bandPlaying.findFirst({
      where: and(
        eq(bandPlaying.eventId, eventId),
        eq(bandPlaying.slug, data.slug),
      ),
      columns: {
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
        soundcloud: true,
        shortDescription: true,
        description: true,
      },
      with: {area: {columns: {id: true, displayName: true, themeColor: true}}},
    });

    if (!band) {
      throw notFound();
    }

    const neighborColumns = {name: true, slug: true, startTime: true} as const;
    const onSameStage = and(
      eq(bandPlaying.eventId, eventId),
      eq(bandPlaying.areaId, band.area.id),
    );

    const [previous, next] = await Promise.all([
      db.query.bandPlaying.findFirst({
        where: and(onSameStage, lt(bandPlaying.startTime, band.startTime)),
        orderBy: desc(bandPlaying.startTime),
        columns: neighborColumns,
      }),
      db.query.bandPlaying.findFirst({
        where: and(onSameStage, gt(bandPlaying.startTime, band.startTime)),
        orderBy: asc(bandPlaying.startTime),
        columns: neighborColumns,
      }),
    ]);

    return {
      ...band,
      photo: await directusImage(band.photo),
      previous:
        previous && isSameDay(previous.startTime, band.startTime)
          ? previous
          : null,
      next: next && isSameDay(next.startTime, band.startTime) ? next : null,
    };
  });

export const Route = createFileRoute('/_main/lineup/$year_/$slug')({
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
          } Uhr, ${loaderData.area.displayName}`,
        })
      : {},
});

function LineupBand() {
  const band = Route.useLoaderData();
  const {year} = Route.useParams();
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
          bgColor={band.area.themeColor}
          color={band.area.id === 'dj' ? 'white' : undefined}
        >
          {band.area.displayName}
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
        band.website ||
        band.soundcloud) && (
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
          {band.soundcloud && (
            <Tooltip content="SoundCloud">
              <Link target="_blank" href={band.soundcloud} color="inherit">
                <FaSoundcloud />
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
      {(band.previous || band.next) && (
        <Box clear="both">
          <Separator mt="8" />
          <HStack mt="4" justify="space-between" align="stretch" gap="4">
            <NeighborLink year={year} label="Davor ab" band={band.previous} />
            <NeighborLink
              year={year}
              label="Danach ab"
              band={band.next}
              align="right"
            />
          </HStack>
        </Box>
      )}
    </Box>
  );
}

function NeighborLink({
  year,
  label,
  band,
  align,
}: {
  year: string;
  label: string;
  band: {name: string; slug: string; startTime: Date} | null;
  align?: 'right';
}) {
  if (!band) {
    return <Box />;
  }
  return (
    <Link asChild color="inherit" textAlign={align}>
      <RouterLink to="/lineup/$year/$slug" params={{year, slug: band.slug}}>
        <Box>
          <Text fontSize="sm" color="brand.500">
            {label}{' '}
            <DateString
              timeOnly
              date={band.startTime}
              options={{hour: '2-digit', minute: '2-digit'}}
            />
            &nbsp;Uhr
          </Text>
          <Text fontWeight="bold">{band.name}</Text>
        </Box>
      </RouterLink>
    </Link>
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
        src={imageUrl(photo.id, {width: 800})}
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
