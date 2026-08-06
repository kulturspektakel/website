import {describe, expect, it} from 'vitest';
import {dayKey, deviceTitle, resolveLocation} from './deviceView';

// A device is relocated over time and DeviceLocation keeps the history, so which
// name a page shows depends on the day being viewed. The rule is documented but
// was unenforced, including its precondition: `locations` must be oldest-first.

const at = (iso: string) => Date.parse(iso);

describe('dayKey', () => {
  it('is the festival-local day, not the UTC one', () => {
    // 23:30 UTC in summer is already the next day in Berlin (UTC+2).
    expect(dayKey(at('2026-07-23T23:30:00Z'))).toBe('2026-07-24');
    // ...and 00:30 UTC in winter is still the same day (UTC+1).
    expect(dayKey(at('2026-01-15T00:30:00Z'))).toBe('2026-01-15');
  });
});

describe('resolveLocation', () => {
  const locations = [
    {name: 'Hauptbühne', createdAt: at('2026-07-20T10:00:00Z')},
    {name: 'Weinzelt', createdAt: at('2026-07-24T10:00:00Z')},
  ];

  it('is null when the device had no location yet', () => {
    expect(resolveLocation([], '2026-07-24')).toBeNull();
    expect(resolveLocation(locations, '2026-07-19')).toBeNull();
  });

  it('picks the placement in effect on the viewed day', () => {
    expect(resolveLocation(locations, '2026-07-20')).toBe('Hauptbühne');
    expect(resolveLocation(locations, '2026-07-23')).toBe('Hauptbühne');
    // Inclusive on the day it was recorded.
    expect(resolveLocation(locations, '2026-07-24')).toBe('Weinzelt');
    expect(resolveLocation(locations, '2026-07-25')).toBe('Weinzelt');
  });

  it('picks the latest placement for the live view', () => {
    expect(resolveLocation(locations, null)).toBe('Weinzelt');
  });

  // Two moves on one day: the later row wins, and only because the array is
  // ordered. This is the precondition the doc comment states — if deviceLocations
  // ever stops ordering by createdAt, this is what breaks.
  it('takes the last qualifying row when several share a day', () => {
    const sameDay = [
      {name: 'früh', createdAt: at('2026-07-24T08:00:00Z')},
      {name: 'spät', createdAt: at('2026-07-24T20:00:00Z')},
    ];
    expect(resolveLocation(sameDay, '2026-07-24')).toBe('spät');
  });
});

describe('deviceTitle', () => {
  const match = (locations: unknown) => [
    {routeId: '/crew/lautstaerke/$device', loaderData: {locations}},
  ];

  it('prefers the location on the viewed day', () => {
    const matches = match([
      {name: 'Hauptbühne', createdAt: at('2026-07-20T10:00:00Z')},
    ]);
    expect(deviceTitle(matches, 'kult-01', '2026-07-24')).toBe('Hauptbühne');
  });

  // head() runs before or without the layout loader's data, so every way of
  // having no location has to fall back rather than throw.
  it('falls back to the device id when there is no location to show', () => {
    expect(deviceTitle([], 'kult-01', null)).toBe('kult-01');
    expect(deviceTitle(match([]), 'kult-01', null)).toBe('kult-01');
    expect(deviceTitle(match(undefined), 'kult-01', null)).toBe('kult-01');
    expect(
      deviceTitle(
        [{routeId: '/crew/lautstaerke/$device', loaderData: undefined}],
        'kult-01',
        null,
      ),
    ).toBe('kult-01');
  });

  it('ignores matches for other routes', () => {
    const matches = [
      {
        routeId: '/crew/lautstaerke',
        loaderData: {locations: [{name: 'falsch', createdAt: 0}]},
      },
    ];
    expect(deviceTitle(matches, 'kult-01', null)).toBe('kult-01');
  });
});
