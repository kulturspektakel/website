import {useMemo, useState} from 'react';
import Day from '../components/lineup/Day';
import {isSameDay, timeZone} from '../utils/dateUtils';
import {SegmentedControlOrSelect} from '../components/SegmentedControlOrSelect';
import {prismaClient} from '../utils/prismaClient';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';

const loader = createServerFn()
  .validator((data: {year: string}) => data)
  .handler(async ({data}) => {
    const bands = await prismaClient.bandPlaying.findMany({
      where: {
        eventId: `kult${data.year}`,
      },
      select: {
        name: true,
        slug: true,
        photo: true,
        startTime: true,
        genre: true,
        areaId: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const areas = await prismaClient.area.findMany({
      select: {
        id: true,
        displayName: true,
        themeColor: true,
      },
    });

    return {
      bands,
      areas,
    };
  });

export const Route = createFileRoute('/lineup/$year')({
  component: LineupYear,
  loader: async ({params}) => await loader({data: {year: params.year}}),
  head: ({params, loaderData}) => {
    return {
      meta: [
        {
          title: `Lineup ${params.year}`,
        },
        {
          name: 'description',
          content: `${loaderData.bands.length} Bands und Künstler:innen treten auf dem Kulturspektakel ${
            params.year
          } auf`,
        },
      ],
    };
  },
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
    () => areas.filter((a) => bands.some((e) => e.areaId === a.id)),
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
