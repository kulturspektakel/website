import {Suspense, useMemo, useState} from 'react';
import Day from '../components/lineup/Day';
import {isSameDay, timeZone} from '../utils/dateUtils';
import {SegmentedControlOrSelect} from '../components/SegmentedControlOrSelect';
import {createFileRoute} from '@tanstack/react-router';
import {loader} from '../server/routes/lineup.$year';
import {seo} from '../utils/seo';
import {StageInfo} from '../components/lineup/StageInfo';
import {Center, Spinner} from '@chakra-ui/react';

export const Route = createFileRoute('/lineup/$year')({
  component: LineupYear,
  loader: async ({params}) => await loader({data: {year: params.year}}),
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
  const [stageFilter, setStageFilter] = useState<string | null>(null);

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

  return (
    <>
      <SegmentedControlOrSelect
        mt={['3', '5']}
        onValueChange={({value}) =>
          setStageFilter(value === 'ALL' ? null : value)
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
