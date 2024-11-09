import {Heading, Text, Box, Image} from '@chakra-ui/react';
import DateString from '~/components//DateString';
import {gql} from '@apollo/client';
import type {BandFragment} from '~/types/graphql';
import Card from '~/components/Card';
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
      aspectRatio={1}
      backgroundImage={band.photo?.scaledUri ? undefined : '/fallback.svg'}
      href={$path('/lineup/:year/:slug', {
        year: band.startTime.getFullYear(),
        slug: band.slug,
      })}
    >
      <Image
        width="100%"
        height="100%"
        src={band.photo?.scaledUri}
        loading="lazy"
        objectFit="cover"
      />
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
          fontSize={['md', 'lg', '2xl']}
          lineClamp={4}
          color="inherit"
          as="h3"
        >
          {band.name}
        </Heading>

        <Text
          lineClamp={2}
          lineHeight="1.1"
          fontWeight="bold"
          fontSize={['xs', 'sm']}
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
          {band.area.displayName}
          {band.genre && <>&nbsp;&middot;&nbsp;{band.genre}</>}
        </Text>
      </Box>
    </Card>
  );
}
