import {gql} from '@apollo/client';
import {
  VStack,
  HStack,
  Heading,
  Text,
  SimpleGrid,
  Tooltip,
  Box,
} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import DateString, {dateStringComponents} from '~/components/DateString';
import Mark from '~/components/Mark';
import type {LineupBandQuery, LineupBandSitemapQuery} from '~/types/graphql';
import {LineupBandDocument} from '~/types/graphql';
import {
  FaSpotify,
  FaYoutube,
  FaInstagram,
  FaFacebook,
  FaGlobe,
} from 'react-icons/fa6';
import mergeMeta from '~/utils/mergeMeta';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {$params, $path} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import apolloClient from '~/utils/apolloClient';
import Image from '~/components/Image';
import {Gallery} from 'react-photoswipe-gallery';
import type {SitemapFunction} from 'remix-sitemap';

gql`
  query LineupBand($id: ID!) {
    node(id: $id) {
      ... on BandPlaying {
        name
        shortDescription
        description
        photo {
          scaledUri(width: 600)
          large: scaledUri(width: 1200)
          width
          height
          copyright
        }
        startTime
        area {
          id
          displayName
          themeColor
        }
        genre
        spotify
        youtube
        website
        instagram
        facebook
      }
    }
  }
`;

export const sitemap: SitemapFunction = async () => {
  const {data} = await apolloClient.query<LineupBandSitemapQuery>({
    query: gql`
      query LineupBandSitemap {
        eventsConnection(first: 100, type: Kulturspektakel) {
          edges {
            node {
              id
              bandsPlaying(first: 100) {
                edges {
                  node {
                    slug
                  }
                }
              }
            }
          }
        }
      }
    `,
  });
  return data.eventsConnection.edges.flatMap(({node: event}) =>
    event.bandsPlaying.edges.map(({node: band}) => ({
      loc: $path('/lineup/:year/:slug', {
        year: event.id.replace('Event:kult', ''),
        slug: band.slug.split('/').pop()!,
      }),
    })),
  );
};

export async function loader(args: LoaderFunctionArgs) {
  const {year, slug} = $params('/lineup/:year/:slug', args.params);
  const {data} = await apolloClient.query<LineupBandQuery>({
    query: LineupBandDocument,
    variables: {
      id: `BandPlaying:lineup/${year}/${slug}`,
    },
  });

  if (data.node?.__typename === 'BandPlaying') {
    return typedjson(data.node);
  }
  throw new Error('Not Found');
}

export const meta = mergeMeta<typeof loader>(({data, params}) => [
  {title: `${data?.name} | Lineup ${params.year}`},
  {
    name: 'description',
    content: `${data?.genre} · ${
      dateStringComponents({
        date: new Date(data!.startTime),
        options: {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        },
      }).date
    } Uhr, ${data?.area.displayName}`,
  },
]);

export default function LineupBand() {
  const band = useTypedLoaderData<typeof loader>();

  const bandPhoto = band.photo ? (
    <Gallery withCaption>
      <Image
        src={band.photo.scaledUri}
        alt={band.name}
        maxHeight="100%"
        m="auto"
        caption={
          band.photo.copyright ? `Foto: ${band.photo.copyright}` : undefined
        }
        originalHeight={band.photo.height}
        originalWidth={band.photo.width}
        original={band.photo.large}
      />
    </Gallery>
  ) : undefined;

  return (
    <SimpleGrid columns={[1, 1, band.photo ? 2 : 1]} spacing="5" mt="8">
      {bandPhoto && <Box display={['none', 'none', 'block']}>{bandPhoto}</Box>}
      <VStack spacing="4" align="start">
        <VStack spacing="1" align="start" mt="3">
          <Text>
            <Mark
              bgColor={band.area.themeColor}
              color={band.area.id === 'Area:dj' ? 'white' : undefined}
            >
              {band.area.displayName}
            </Mark>
          </Text>
          <Heading as="h2" size="lg">
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
            &nbsp;Uhr&nbsp;&middot;&nbsp;{band.genre}
          </Text>
        </VStack>
        {band.photo && (
          <Box
            maxHeight={band.photo.height > band.photo.width ? 300 : undefined}
            display={['block', 'block', 'none']}
            textAlign="center"
            mb="4"
            w="100%"
          >
            {bandPhoto}
          </Box>
        )}
        {(band.spotify ||
          band.youtube ||
          band.instagram ||
          band.facebook ||
          band.website) && (
          <HStack fontSize="28px" gap="6" color="brand.900">
            {band.spotify && (
              <Tooltip label="Spotify">
                <Link target="_blank" to={band.spotify}>
                  <FaSpotify />
                </Link>
              </Tooltip>
            )}
            {band.youtube && (
              <Tooltip label="YouTube">
                <Link target="_blank" to={band.youtube}>
                  <FaYoutube />
                </Link>
              </Tooltip>
            )}
            {band.instagram && (
              <Tooltip label="Instagram">
                <Link target="_blank" to={band.instagram}>
                  <FaInstagram />
                </Link>
              </Tooltip>
            )}
            {band.facebook && (
              <Tooltip label="Facebook">
                <Link target="_blank" to={band.facebook}>
                  <FaFacebook />
                </Link>
              </Tooltip>
            )}
            {band.website && (
              <Tooltip label={band.website}>
                <Link target="_blank" to={band.website}>
                  <FaGlobe />
                </Link>
              </Tooltip>
            )}
          </HStack>
        )}
        <Text>{band.shortDescription ?? band.description}</Text>
      </VStack>
    </SimpleGrid>
  );
}
