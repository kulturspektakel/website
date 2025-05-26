import {Cell} from './CardActivities';
import {Text} from '@chakra-ui/react';

export function Highscore({
  name,
  place,
  points,
}: {
  place: number;
  name: string;
  points: number;
}) {
  return (
    <Cell
      accessoryStart={place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
      subtitle={<Text fontWeight="bold">{name}</Text>}
      accessoryEnd={points}
    />
  );
}
