import {Heading, Text} from '@chakra-ui/react';
import DateString from '../DateString';
import {gql} from '@apollo/client';
import type {BandFragment} from '~/types/graphql';
import Mark from '../Mark';
import Card from '../Card';
import {$path} from 'remix-routes';

gql`
  fragment Band on BandPlaying {
    id
    name
    startTime
    slug
    area {
      displayName
      themeColor
    }
    genre
    photo {
      scaledUri(height: 200, width: 200)
    }
  }
`;

export default function Band({band}: {band: BandFragment}) {
  return (
    <Card
      href={$path('/lineup/:year/:slug', {
        year: band.startTime.getFullYear(),
        slug: band.slug,
      })}
      preventScrollReset
      bgImg={band.photo?.scaledUri}
    >
      <Mark bgColor={band.area.themeColor}>
        <DateString
          timeOnly
          date={band.startTime}
          options={{
            hour: '2-digit',
            minute: '2-digit',
          }}
        />
        &nbsp;
        {band.area.displayName}
      </Mark>
      <Heading mt="1.5" size="lg" noOfLines={4}>
        {band.name}
      </Heading>
      {band.genre && <Text>{band.genre}</Text>}
    </Card>
  );
}
