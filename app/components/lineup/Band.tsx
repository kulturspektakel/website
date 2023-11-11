import {Heading, Text, Box} from '@chakra-ui/react';
import DateString from '../DateString';
import {gql} from '@apollo/client';
import type {BandFragment} from '~/types/graphql';
import Card from '../Card';
import {$path} from 'remix-routes';

gql`
  fragment Band on BandPlaying {
    id
    name
    startTime
    slug
    area {
      id
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
      bgColor="offwhite.300"
      imageBlendMode="luminosity"
      image={band.photo?.scaledUri}
    >
      <Box
        position="absolute"
        bottom="2"
        left="2"
        mr="2"
        bgColor={band.area.themeColor}
        pt="2"
        pb="1"
        px="2"
        color={band.area.id === 'Area:a' ? undefined : 'white'}
        textAlign="left"
        borderRadius="md"
      >
        <Heading
          sx={{hyphens: 'auto'}}
          fontSize={['xl', '2xl']}
          noOfLines={4}
          color="inherit"
          as="h3"
        >
          {band.name}
        </Heading>
        {band.genre && (
          <Text
            noOfLines={[2, 2, 1]}
            lineHeight="1"
            fontWeight="bold"
            fontSize="sm"
            mt="0.5"
          >
            <DateString
              timeOnly
              date={band.startTime}
              options={{
                hour: '2-digit',
                minute: '2-digit',
              }}
            />
            &nbsp;
            {band.area.displayName}&nbsp;&middot; {band.genre}
          </Text>
        )}
      </Box>
    </Card>
  );
}
