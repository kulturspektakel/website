import {gql} from '@apollo/client';
import {
  VStack,
  HStack,
  Heading,
  Image,
  Text,
  SimpleGrid,
  Tooltip,
  Box,
} from '@chakra-ui/react';
import type {V2_MetaFunction} from '@remix-run/react';
import {Link} from '@remix-run/react';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';
import type {LineupBandQuery} from '~/types/graphql';
import {LineupBandDocument} from '~/types/graphql';
import {
  FaSpotify,
  FaYoutube,
  FaInstagram,
  FaFacebook,
  FaGlobe,
} from 'react-icons/fa6';
import {mergeMeta} from '~/utils/mergeMeta';
import type {LoaderArgs} from '@remix-run/node';
import {$params} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import apolloClient from '~/utils/apolloClient';

gql`
  query LineupBand($id: ID!) {
    node(id: $id) {
      ... on BandPlaying {
        name
        shortDescription
        description
        photo {
          scaledUri(width: 600)
          width
          height
        }
        startTime
        area {
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

export async function loader(args: LoaderArgs) {
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

export const meta: V2_MetaFunction<typeof loader> = mergeMeta((args) => [
  {title: `${args.data.name} – Lineup ${args.params.year}`},
]);

export default function LineupBand() {
  const band = useTypedLoaderData<typeof loader>();

  const bandPhoto = band.photo ? (
    <Image
      src={band.photo?.scaledUri}
      alt={band.name}
      borderRadius="xl"
      transform="rotate(-1deg)"
      boxShadow="lg"
      transition="transform 0.1s ease-in-out"
      _hover={{transform: 'rotate(1deg)'}}
      maxHeight="100%"
      m="auto"
    />
  ) : undefined;

  return (
    <SimpleGrid columns={[1, 1, band.photo ? 2 : 1]} spacing="5">
      {bandPhoto && <Box display={['none', 'none', 'block']}>{bandPhoto}</Box>}
      <VStack spacing="4" align="start">
        <VStack spacing="1" align="start" mt="3">
          <Text>
            <Mark bgColor={band.area.themeColor}>{band.area.displayName}</Mark>
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
