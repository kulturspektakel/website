import {createServerFn} from '@tanstack/react-start';
import {multiPage} from '../../utils/markdownText.server';
import {convertIcsCalendar, type IcsCalendar} from 'ts-ics';

export const loader = createServerFn().handler(async () => {
  const calendarUrl =
    'https://calendar.google.com/calendar/ical/c_d5cfc52054d3dae0761245fee799a7c2c61691fb62554f30ea652adcca183304%40group.calendar.google.com/public/basic.ics';

  const cal = await fetch(calendarUrl).then((res) => res.text());

  return {
    crewCalendar:
      convertIcsCalendar<IcsCalendar>(undefined, cal)
        ?.events?.map((e) => ({
          start: e.start.date,
          end: e.end?.date,
          id: e.uid,
          summary: e.summary,
          location: e.location?.replace(/\\,/g, ','),
          allDay: e.start.type === 'DATE',
        }))
        .filter((e) => e.start.getTime() > Date.now())
        .sort((a, b) => a.start.getTime() - b.start.getTime()) ?? [],
    calendarUrl,
    pages: await multiPage(['infos', 'verein']),
  };
});
