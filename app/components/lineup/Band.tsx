import {Heading, Text, Box, Image} from '@chakra-ui/react';
import DateString from '../DateString';
import Card from '../Card';
import {imageUrl} from '../../utils/directusImage';

export default function Band({
  band,
  area,
}: {
  area: {
    id: string;
    displayName: string;
    themeColor: string;
  };
  band: {
    name: string;
    startTime: Date;
    slug: string;
    genre: string | null;
    photo: string | null;
  };
}) {
  return (
    <Card
      aspectRatio={1}
      link={{
        to: '/lineup/$year/$slug',
        params: {
          year: String(band.startTime.getFullYear()),
          slug: band.slug,
        },
      }}
    >
      <Image
        width="100%"
        height="100%"
        src={imageUrl(band.photo, {width: 464}) ?? '/fallback.svg'}
        loading="lazy"
        objectFit="cover"
      />
      <Box
        position="absolute"
        bottom="2"
        left="2"
        mr="2"
        bgColor={area.themeColor}
        pt="2"
        pb="1"
        px="2"
        color={area.id === 'Area:a' ? undefined : 'white'}
        textAlign="left"
        borderRadius="md"
      >
        <Heading
          hyphens="auto"
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
          {area.displayName}
          {band.genre && <>&nbsp;&middot; {band.genre}</>}
        </Text>
      </Box>
    </Card>
  );
}
