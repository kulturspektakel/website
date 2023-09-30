import {gql} from '@apollo/client';
import {
  Button,
  ButtonGroup,
  Modal,
  ModalContent,
  ModalOverlay,
  Spinner,
} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {
  Outlet,
  ScrollRestoration,
  useNavigate,
  useParams,
} from '@remix-run/react';
import {Suspense, useState} from 'react';
import {$params, $path} from 'remix-routes';
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
  const navigate = useNavigate();
  const {year, slug} = useParams();
  const [stageFilter, setStageFilter] = useState<string | null>(null);

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

  return (
    <>
      <ButtonGroup isAttached mt="3" display="flex">
        <Button
          onClick={() => setStageFilter(null)}
          variant={stageFilter === null ? 'primary' : undefined}
          aria-pressed={stageFilter == null}
          flexGrow="1"
        >
          Alle
        </Button>
        {areas
          .filter(
            (a) =>
              event?.bandsPlaying.edges.some((e) => e.node.area.id === a.id),
          )
          .map((area) => (
            <Button
              flexGrow="1"
              key={area.id}
              aria-pressed={area.id === stageFilter}
              onClick={() => setStageFilter(area.id)}
              variant={area.id === stageFilter ? 'primary' : undefined}
            >
              {area.displayName}
            </Button>
          ))}
      </ButtonGroup>
      {days.map((day) => (
        <Day
          key={day.toISOString()}
          day={day}
          bandsPlaying={
            event!.bandsPlaying.edges
              .map((band) => band.node)
              .filter((band) => {
                if (!isSameDay(day, band.startTime)) {
                  return false;
                }
                if (stageFilter && band.area.id !== stageFilter) {
                  return false;
                }
                return true;
              }) ?? []
          }
        />
      ))}
      <Modal
        isOpen={!!slug}
        onClose={() =>
          navigate($path('/lineup/:year', {year}), {preventScrollReset: true})
        }
      >
        <ModalOverlay />
        <ModalContent p="6">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </ModalContent>
      </Modal>
    </>
  );
}
