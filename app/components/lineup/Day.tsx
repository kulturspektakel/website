import {Heading, SimpleGrid} from '@chakra-ui/react';
import DateString from '../DateString';
import Band from './Band';
import type {BandFragment} from '~/types/graphql';

export default function Day({
  day,
  bandsPlaying,
}: {
  day: Date;
  bandsPlaying: BandFragment[];
}) {
  return (
    <>
      <Heading textAlign="center" mt="8" mb="6">
        <DateString
          date={day}
          options={{weekday: 'long', day: '2-digit', month: 'long'}}
        />
      </Heading>
      <SimpleGrid minChildWidth="200px" spacing="3">
        {bandsPlaying.map((band) => (
          <Band key={band.id} band={band} />
        ))}
      </SimpleGrid>
    </>
  );
}