import {Heading, SimpleGrid} from '@chakra-ui/react';
import DateString from '../DateString';
import Band from './Band';

export default function Day({
  day,
  bandsPlaying,
}: {
  day: Date;
  bandsPlaying: Array<React.ComponentProps<typeof Band>>;
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
          <Band key={band.slug} band={band} area={area} />
        ))}
      </SimpleGrid>
    </>
  );
}
