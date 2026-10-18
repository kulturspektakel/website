import {Suspense, useMemo} from 'react';
import Day from '../components/lineup/Day';
import {isSameDay, timeZone} from '../utils/dateUtils';
import {SegmentedControlOrSelect} from '../components/SegmentedControlOrSelect';
import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {asc, eq} from 'drizzle-orm';
import {db} from '../server/db.server';
import {area, bandPlaying} from '../server/db/schema';
import {seo} from '../utils/seo';

const loader = createServerFn()
  .validator((data: {year: string}) => data)
  .handler(async ({data}) => {
    const bands = await db
      .select({
        name: bandPlaying.name,
        slug: bandPlaying.slug,
        photo: bandPlaying.photo,
        startTime: bandPlaying.startTime,
        genre: bandPlaying.genre,
        areaId: bandPlaying.areaId,
        spotifyPreviewUrl: bandPlaying.spotifyPreviewUrl,
      })
      .from(bandPlaying)
      .where(eq(bandPlaying.eventId, `kult${data.year}`))
      .orderBy(asc(bandPlaying.startTime));

    const areas = await db
      .select({
        id: area.id,
        displayName: area.displayName,
        themeColor: area.themeColor,
        order: area.order,
      })
      .from(area);

    return {
      bands,
      areas,
    };
  });
import {StageInfo} from '../components/lineup/StageInfo';
import {Center, Spinner} from '@chakra-ui/react';
import {useSpotifyPlayer} from '../components/lineup/SpotifyPlayer';

export const Route = createFileRoute('/_main/lineup/$year')({
  component: LineupYear,
  loader: async ({params}) => await loader({data: {year: params.year}}),
  validateSearch: (search: Record<string, unknown>): {stage?: string} => ({
    stage: typeof search.stage === 'string' ? search.stage : undefined,
  }),
  head: ({params, loaderData}) =>
    loaderData
      ? seo({
          title: `Lineup ${params.year}`,
          description: `${loaderData.bands.length} Bands und Künstler:innen treten auf dem Kulturspektakel ${
            params.year
          } auf`,
        })
      : {},
});

function LineupYear() {
  const {areas, bands} = Route.useLoaderData();
  const {stage: stageFilter} = Route.useSearch();
  const navigate = useNavigate({from: Route.fullPath});

  const dateStrings = new Set<string>();
  const days = bands.reduce<Date[]>((acc, band) => {
    const yyyyMmDd = band.startTime.toLocaleDateString('fr-CA', {
      timeZone,
    });
    if (dateStrings.has(yyyyMmDd)) {
      return acc;
    }
    dateStrings.add(yyyyMmDd);
    acc.push(band.startTime);
    return acc;
  }, []);

  const activeAreas = useMemo(
    () =>
      areas
        .filter((a) => bands.some((e) => e.areaId === a.id))
        .sort((a, b) => a.order - b.order),
    [areas, bands],
  );

  const player = useSpotifyPlayer();

  return (
    <>
      <SegmentedControlOrSelect
        mt={['3', '5']}
        onValueChange={({value}) =>
          navigate({
            search: {stage: value && value !== 'ALL' ? value : undefined},
            replace: true,
          })
        }
        value={stageFilter ?? 'ALL'}
        items={[
          {label: 'Alle Bühnen', value: 'ALL'},
          ...activeAreas.map((a) => ({label: a.displayName, value: a.id})),
        ]}
      />
      <Suspense
        fallback={
          <Center py="10">
            <Spinner />
          </Center>
        }
      >
        {stageFilter && <StageInfo id={stageFilter} />}
      </Suspense>
      {days.map((day) => (
        <Day
          key={day.toISOString()}
          day={day}
          player={player}
          bandsPlaying={bands
            .filter((band) => {
              if (!isSameDay(day, band.startTime)) {
                return false;
              }
              if (stageFilter && band.areaId !== stageFilter) {
                return false;
              }
              return true;
            })
            .map((band) => ({
              band,
              area: activeAreas.find((a) => a.id === band.areaId)!,
            }))}
        />
      ))}
    </>
  );
}
