import {gql} from '@apollo/client';
import {Button, ButtonGroup} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {$params} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Day from '~/components/lineup/Day';
import type {LineupQuery} from '~/types/graphql';
import {LineupDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {isSameDay, timeZone} from '~/utils/dateUtils';

gql`
  query Lineup($id: ID!) {
    node(id: $id) {
      ... on Event {
        name
        start
        end
        bandsPlaying(first: 100) {
          edges {
            node {
              ...Band
              area {
                id
              }
            }
          }
        }
      }
    }
    areas {
      id
      displayName
    }
  }
`;

export type SearchParams = {
  year: number;
};

export async function loader(args: LoaderArgs) {
  const {year} = $params('/lineup/:year', args.params);
  const {data} = await apolloClient.query<LineupQuery>({
    query: LineupDocument,
    variables: {
      id: `Event:kult${year}`,
    },
  });

  return typedjson(data);
}

export default function LineupYear() {
  const {areas, node} = useTypedLoaderData<typeof loader>();
  const event = node?.__typename === 'Event' ? node : null;

  const dateStrings = new Set<string>();
  const days = event!.bandsPlaying.edges.reduce<Date[]>((acc, {node}) => {
    const yyyyMmDd = node.startTime.toLocaleDateString('fr-CA', {timeZone});
    if (dateStrings.has(yyyyMmDd)) {
      return acc;
    }
    dateStrings.add(yyyyMmDd);
    acc.push(node.startTime);
    return acc;
  }, []);

  const activeStages = event!.bandsPlaying.edges.reduce(
    (acc, {node}) => acc.add(node.area.id),
    new Set<string>(),
  );
  const stages = event!.bandsPlaying.edges.reduce((acc, {node}) => {
    if (acc.findIndex((stage) => stage.displayName === node.area) === -1) {
      acc.push(node.area);
    }
    return acc;
  }, []);

  return (
    <>
      <ButtonGroup isAttached>
        {areas.map((area) => (
          <Button key={area.id}>{area.displayName}</Button>
        ))}
      </ButtonGroup>
      {days.map((day) => {
        return (
          <Day
            key={day.toISOString()}
            day={day}
            bandsPlaying={
              event!.bandsPlaying.edges
                .map((band) => band.node)
                .filter((band) => isSameDay(band.startTime, day)) ?? []
            }
          />
        );
      })}
    </>
  );
}
