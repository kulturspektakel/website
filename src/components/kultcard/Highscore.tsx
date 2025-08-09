import {Cell} from './CardActivities';
import {Heading, ListRoot, Text} from '@chakra-ui/react';

export type HighscoreEntry = {
  cardId: string;
  amount: number;
  rank: number;
  emoji: string | null;
  name: string;
  productList: string;
};
export type HighscoreProps = {
  [x: number]: Array<HighscoreEntry>;
};
export function Highscore({data}: {data: HighscoreProps}) {
  return (
    <>
      {Object.values(data).map((values) => (
        <>
          <Heading textAlign="center" mt="3">
            {values[0].emoji} {values[0].productList}
          </Heading>
          <ListRoot as="ol" m="0">
            {values.map((value) => (
              <Cell
                accessoryStart={
                  value.rank === 1 ? '🥇' : value.rank === 2 ? '🥈' : '🥉'
                }
                subtitle={<Text fontWeight="bold">{value.name}</Text>}
                accessoryEnd={value.amount}
              />
            ))}
          </ListRoot>
        </>
      ))}
    </>
  );
}
