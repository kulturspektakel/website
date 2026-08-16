import {describe, expect, test} from 'vitest';
import {legacyNoiseRedirect} from './legacyNoiseRedirect';

const location = (path: string) =>
  legacyNoiseRedirect(
    new Request(`https://kulturspektakel.de${path}`),
  )?.headers.get('Location') ?? null;

describe('legacyNoiseRedirect', () => {
  test('the area itself', () => {
    expect(location('/crew/lautstaerke')).toBe('/crew/noise');
  });

  test('trailing slash lands on the same place, not on an empty segment', () => {
    expect(location('/crew/lautstaerke/')).toBe('/crew/noise');
  });

  test('a device keeps its id', () => {
    expect(location('/crew/lautstaerke/device/SIM-1')).toBe(
      '/crew/noise/device/SIM-1',
    );
  });

  test('the German segments are renamed where they sit', () => {
    expect(location('/crew/lautstaerke/projekt/abc123')).toBe(
      '/crew/noise/project/abc123',
    );
    expect(location('/crew/lautstaerke/projekt/abc123/karte')).toBe(
      '/crew/noise/project/abc123/map',
    );
    expect(location('/crew/lautstaerke/projekt/abc123/liste')).toBe(
      '/crew/noise/project/abc123/list',
    );
  });

  // The whole point for a shared link: the moment is in the query.
  test('the query string comes across untouched', () => {
    expect(
      location(
        '/crew/lautstaerke/projekt/abc123/karte?live=false&from=2025-08-24T18%3A00%3A00.000Z&to=2025-08-24T20%3A00%3A00.000Z',
      ),
    ).toBe(
      '/crew/noise/project/abc123/map?live=false&from=2025-08-24T18%3A00%3A00.000Z&to=2025-08-24T20%3A00%3A00.000Z',
    );
  });

  test('307 and cached at the edge, not in the browser', () => {
    const res = legacyNoiseRedirect(
      new Request('https://kulturspektakel.de/crew/lautstaerke'),
    );
    expect(res?.status).toBe(307);
    expect(res?.headers.get('Cache-Control')).toContain('max-age=0');
    expect(res?.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  test('leaves everything else alone', () => {
    for (const path of [
      '/crew/noise',
      '/crew/noise/project/abc123/map',
      '/crew/produkte',
      '/crew/lautstaerke-archiv',
      '/lautstaerke',
      '/',
    ]) {
      expect(
        legacyNoiseRedirect(new Request(`https://kulturspektakel.de${path}`)),
      ).toBeNull();
    }
  });
});
