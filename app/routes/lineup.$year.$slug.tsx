import {gql} from '@apollo/client';
import {Button, ButtonGroup} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Day from '~/components/lineup/Day';
import type {LineupQuery} from '~/types/graphql';
import {LineupDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';

gql`
  query LineupBand($id: ID!) {
    node(id: $id) {
      ... on BandPlaying {
        name
      }
    }
  }
`;

export type SearchParams = {
  year: number;
  slug: string;
};

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<LineupQuery>({
    query: LineupDocument,
    variables: {
      id: `Event:kult2022`,
    },
  });

  return typedjson(data);
}

export default function LineupBand() {
  return <>okoko</>;
}
