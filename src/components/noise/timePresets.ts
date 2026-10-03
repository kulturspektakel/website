import {addDays} from 'date-fns';
import {dayLabelOf, zonedDate} from './chartUtils';
import {visibleProjectWindow} from './projectSelection';
import {zonedStartOfDay} from './timeframe';

// The windows the playhead's menu offers instead of a bare "history": a press that leaves
// live and frames something worth looking at, rather than leaving the reader to drag the
// strip there. In epoch ms, like the selection they become (see projectSelection.ts).
export type TimePreset = {
  key: string;
  label: string;
  start: number;
  end: number;
};

const HOUR_MS = 60 * 60 * 1000;

// Calendar days in the festival's zone, which is what "today" and a date on the strip mean
// here — whatever zone the reader is in (see zonedStartOfDay).
const dayStart = (ms: number) => zonedStartOfDay(ms).getTime();
const nextDayStart = (ms: number) => addDays(zonedStartOfDay(ms), 1).getTime();

/**
 * What the menu offers for a project at `now`.
 *
 *   before it    — nothing: there is nothing measured to frame.
 *   while it runs — relative windows: the last hour, today, yesterday, then each earlier day
 *                   of the event by its date.
 *   after it     — each day of the event by its date.
 *
 * Days newest first either way.
 *
 * Every window is clipped to the event and to `now`, which is the furthest anything was
 * measured — so the first day starts with the event rather than at midnight, and today ends
 * at the live edge.
 */
export function timePresets(
  project: {start: number; end: number},
  now: number,
): TimePreset[] {
  if (now < project.start) return [];
  // The furthest anything was measured — the page's own live edge, so a window ending here
  // is the same instant the selection's end is clamped to (see resolveProjectSelection).
  const edge = visibleProjectWindow(project, now).end;
  const running = now <= project.end;
  const today = dayStart(now);
  const yesterday = dayStart(today - 1);
  const days: TimePreset[] = [];
  for (let day = dayStart(project.start); day < edge; day = nextDayStart(day)) {
    days.push({
      key: `day:${day}`,
      label:
        running && day === today
          ? 'Today'
          : running && day === yesterday
            ? 'Yesterday'
            : dayLabelOf(zonedDate(day / 1000)),
      start: Math.max(day, project.start),
      end: Math.min(nextDayStart(day), edge),
    });
  }
  // Newest first in both cases: the reader is after a particular night, and the most recent
  // is the one most often wanted.
  days.reverse();
  if (!running) return days;
  return [
    {
      key: 'hour',
      label: 'Last hour',
      start: Math.max(project.start, now - HOUR_MS),
      end: edge,
    },
    ...days,
  ];
}
