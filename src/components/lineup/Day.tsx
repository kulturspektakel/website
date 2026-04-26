import {Heading, SimpleGrid} from '@chakra-ui/react';
import DateString from '../DateString';
import Band from './Band';
import type {SpotifyPlayerState} from '../SpotifyPlayer';

export default function Day({
  day,
  bandsPlaying,
  player,
}: {
  day: Date;
  bandsPlaying: Array<Omit<React.ComponentProps<typeof Band>, 'player'>>;
  player: SpotifyPlayerState;
}) {
  return (
    <>
      <Heading size="2xl" textAlign="center" mt="10" mb="10">
        <DateString
          date={day}
          options={{weekday: 'long', day: '2-digit', month: 'long'}}
        />
      </Heading>
      <SimpleGrid columns={[2, 3]} gap="3">
        {bandsPlaying.map(({band, area}) => (
          <Band key={band.slug} band={band} area={area} player={player} />
        ))}
      </SimpleGrid>
    </>
  );
}
