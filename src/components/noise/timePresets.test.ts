import {describe, expect, it} from 'vitest';
import {timePresets} from './timePresets';

// Festival time is Europe/Berlin, two hours ahead of UTC in summer.
const at = (iso: string) => Date.parse(iso);
// Fri 31 Jul 18:00 to Sun 2 Aug 23:00, Berlin.
const project = {
  start: at('2026-07-31T16:00:00Z'),
  end: at('2026-08-02T21:00:00Z'),
};

describe('timePresets', () => {
  it('offers nothing before the event', () => {
    expect(timePresets(project, at('2026-07-30T12:00:00Z'))).toEqual([]);
  });

  it('offers relative windows newest first while it runs', () => {
    // Sun 2 Aug 15:00 Berlin.
    const now = at('2026-08-02T13:00:00Z');
    const presets = timePresets(project, now);
    expect(presets.map((p) => p.label)).toEqual([
      'Last hour',
      'Today',
      'Yesterday',
      'Fr 31.07.',
    ]);
    expect(presets[0]).toMatchObject({start: now - 3_600_000, end: now});
    // Today runs from Berlin midnight to the live edge.
    expect(presets[1]).toMatchObject({
      start: at('2026-08-01T22:00:00Z'),
      end: now,
    });
    // The first day starts with the event, not at midnight.
    expect(presets[3]).toMatchObject({
      start: project.start,
      end: at('2026-07-31T22:00:00Z'),
    });
  });

  it('offers every day of the event, newest first, once it is over', () => {
    const presets = timePresets(project, at('2026-08-10T12:00:00Z'));
    expect(presets.map((p) => p.label)).toEqual([
      'So 02.08.',
      'Sa 01.08.',
      'Fr 31.07.',
    ]);
    expect(presets[0]!.end).toBe(project.end);
  });
});
