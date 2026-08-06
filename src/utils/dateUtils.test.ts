import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {isSameDay, locale, timeZone} from './dateUtils';

const SRC = join(import.meta.dirname, '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Generated Prisma client ships its own doc comments and examples.
      if (entry.name !== 'generated') sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(path);
    }
  }
  return out;
}

describe('timeZone', () => {
  it('is the festival timezone', () => {
    expect(timeZone).toBe('Europe/Berlin');
    expect(locale).toBe('de-DE');
  });

  // The point of a single definition is that it stays single. Anything that
  // re-states the zone can silently drift out of step with this module — and
  // more importantly, a call site writing its own literal is usually a call site
  // that hasn't thought about which of its dates are UTC.
  it('is not re-declared anywhere else in src/', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => path !== join(SRC, 'utils', 'dateUtils.ts'))
      .filter((path) => readFileSync(path, 'utf8').includes(`'${timeZone}'`))
      .map((path) => path.slice(SRC.length + 1));

    expect(offenders).toEqual([]);
  });
});

// Guards the whole reason the zone is explicit: these must answer by Berlin
// wall-clock, not by whatever zone the test machine is in.
describe('isSameDay', () => {
  it('compares by festival-local day, not UTC day', () => {
    // 22:30 UTC on the 1st is already 00:30 on the 2nd in CEST.
    const lateUtc = new Date('2026-08-01T22:30:00Z');
    const nextMorning = new Date('2026-08-02T06:00:00Z');
    expect(isSameDay(lateUtc, nextMorning)).toBe(true);

    // ...and the same instant is *not* the same day as the 1st locally.
    expect(isSameDay(lateUtc, new Date('2026-08-01T09:00:00Z'))).toBe(false);
  });

  it('uses the winter offset in winter', () => {
    // 23:30 UTC on the 1st is 00:30 on the 2nd in CET (UTC+1).
    expect(
      isSameDay(
        new Date('2026-01-01T23:30:00Z'),
        new Date('2026-01-02T06:00:00Z'),
      ),
    ).toBe(true);
  });
});
