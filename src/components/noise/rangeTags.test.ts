import {describe, expect, it} from 'vitest';
import {ignoredDevicesAt, locationTags, type NoiseRangeTag} from './rangeTags';
import type {DeviceWindows} from './projectView';

const at = (iso: string) => Date.parse(iso);

const tag = (
  id: string,
  scope: {locationId?: string; deviceId?: string},
  start: string,
  end: string | null,
): NoiseRangeTag => ({
  id,
  type: 'IGNORE',
  text: null,
  locationId: scope.locationId ?? null,
  deviceId: scope.deviceId ?? null,
  start: at(start),
  end: end == null ? null : at(end),
});

// `m1` stood here from 18:00 to 20:00, and nowhere else is on this chart.
const lines: DeviceWindows[] = [
  {
    deviceId: 'm1',
    lastSeen: null,
    windows: [
      {start: at('2026-07-25T18:00:00Z'), end: at('2026-07-25T20:00:00Z')},
    ],
  },
];

describe('locationTags', () => {
  it('keeps the event, this location, and a monitor while it stood here', () => {
    const tags = [
      tag('event', {}, '2026-07-25T12:00:00Z', '2026-07-25T13:00:00Z'),
      tag('here', {locationId: 'a'}, '2026-07-25T12:00:00Z', null),
      tag('elsewhere', {locationId: 'b'}, '2026-07-25T12:00:00Z', null),
      tag(
        'm1-here',
        {deviceId: 'm1'},
        '2026-07-25T19:00:00Z',
        '2026-07-25T21:00:00Z',
      ),
      tag(
        'm1-later',
        {deviceId: 'm1'},
        '2026-07-25T20:00:00Z',
        '2026-07-25T21:00:00Z',
      ),
      tag('m2', {deviceId: 'm2'}, '2026-07-25T19:00:00Z', null),
    ];
    expect(locationTags(tags, 'a', lines).map((t) => t.id)).toEqual([
      'event',
      'here',
      'm1-here',
    ]);
  });
});

describe('ignoredDevicesAt', () => {
  const noon = at('2026-07-25T12:30:00Z');
  const tags = [
    tag('m1', {deviceId: 'm1'}, '2026-07-25T12:00:00Z', '2026-07-25T13:00:00Z'),
    tag('marker', {locationId: 'a'}, '2026-07-25T12:30:00Z', null),
  ];

  it('ignores a tagged monitor but not a marker', () => {
    expect([...ignoredDevicesAt(tags, 'a', ['m1', 'm2'], noon)]).toEqual([
      'm1',
    ]);
  });

  it('ignores every monitor under a location tag', () => {
    const place = tag(
      'a',
      {locationId: 'a'},
      '2026-07-25T12:00:00Z',
      '2026-07-25T13:00:00Z',
    );
    expect([...ignoredDevicesAt([place], 'a', ['m1', 'm2'], noon)]).toEqual([
      'm1',
      'm2',
    ]);
  });
});
