import {gql} from '@apollo/client';
import {Modal, ModalContent, ModalOverlay, Spinner} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {Outlet, useNavigate, useParams} from '@remix-run/react';
import {Suspense, useMemo, useState} from 'react';
import {$params, $path} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Selector from '~/components/Selector';
import Day from '~/components/lineup/Day';
import type {LineupQuery, LineupSitemapQuery} from '~/types/graphql';
import {LineupDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {isSameDay, timeZone} from '~/utils/dateUtils';
import mergeMeta from '~/utils/mergeMeta';
import type {SitemapFunction} from 'remix-sitemap';

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
        bandApplicationStart
        bandApplicationEnd
        djApplicationStart
        djApplicationEnd
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

export const sitemap: SitemapFunction = async () => {
  const {data} = await apolloClient.query<LineupSitemapQuery>({
    query: gql`
      query LineupSitemap {
        eventsConnection(first: 100, type: Kulturspektakel) {
          edges {
            node {
              id
            }
          }
        }
      }
    `,
  });
  return data.eventsConnection.edges.map(({node}) => ({
    loc: $path('/lineup/:year', {year: node.id.replace('Event:kult', '')}),
  }));
};

export const meta = mergeMeta<typeof loader>(({data, params}) => {
  return [
    {
      title: `Lineup ${params.year}`,
    },
    {
      name: 'description',
      content: `${
        data?.node?.__typename === 'Event'
          ? data.node.bandsPlaying.edges.length
          : 'viele'
      } Bands und Künstler:innen treten auf dem Kulturspektakel ${
        params.year
      } auf`,
    },
  ];
});

export async function loader(args: LoaderFunctionArgs) {
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
    const yyyyMmDd = node.startTime.toLocaleDateString('fr-CA', {
      timeZone,
    });
    if (dateStrings.has(yyyyMmDd)) {
      return acc;
    }
    dateStrings.add(yyyyMmDd);
    acc.push(node.startTime);
    return acc;
  }, []);

  const activeAreas = useMemo(
    () =>
      areas.filter((a) =>
        event?.bandsPlaying.edges.some((e) => e.node.area.id === a.id),
      ),
    [areas, event?.bandsPlaying.edges],
  );

  return (
    <>
      <Selector
        allLabelSmall="Alle Bühnen"
        onChange={setStageFilter}
        value={stageFilter}
        options={activeAreas.map((a) => ({name: a.displayName, id: a.id}))}
      />
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
          navigate($path('/lineup/:year', {year: String(year)}), {
            preventScrollReset: true,
          })
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
