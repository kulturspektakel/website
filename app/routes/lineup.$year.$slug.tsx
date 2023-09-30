import {gql, useSuspenseQuery} from '@apollo/client';
import {
  HStack,
  Image,
  ModalBody,
  ModalCloseButton,
  ModalHeader,
} from '@chakra-ui/react';
import {Link, useParams} from '@remix-run/react';
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

gql`
  query LineupBand($id: ID!) {
    node(id: $id) {
      ... on BandPlaying {
        name
        shortDescription
        description
        photo {
          scaledUri(width: 800)
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

export type SearchParams = {
  year: number;
  slug: string;
};

export default function LineupBand() {
  const {year, slug} = useParams();
  const {data} = useSuspenseQuery<LineupBandQuery>(LineupBandDocument, {
    variables: {
      id: `BandPlaying:lineup/${year}/${slug}`,
    },
  });
  const band = data?.node?.__typename === 'BandPlaying' ? data.node : null;
  if (!band) return null;

  return (
    <>
      <ModalHeader as="h2" fontSize="lg">
        {band.name}
      </ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        {band.photo && <Image src={band.photo?.scaledUri} alt={band.name} />}
        <DateString
          options={{
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long',
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
          }}
          date={band.startTime}
        />
        <Mark bgColor={band.area.themeColor}>{band.area.displayName}</Mark>

        <HStack fontSize="xl" justify="space-around">
          {band.spotify && (
            <Link to={band.spotify}>
              <FaSpotify />
            </Link>
          )}
          {band.youtube && (
            <Link to={band.youtube}>
              <FaYoutube />
            </Link>
          )}
          {band.instagram && (
            <Link to={band.instagram}>
              <FaInstagram />
            </Link>
          )}
          {band.facebook && (
            <Link to={band.facebook}>
              <FaFacebook />
            </Link>
          )}
          {band.website && (
            <Link to={band.website}>
              <FaGlobe />
            </Link>
          )}
        </HStack>
        {band.genre}
        {band.shortDescription ?? band.description}
      </ModalBody>
    </>
  );
}
