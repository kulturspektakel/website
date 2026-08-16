import {describe, expect, it} from 'vitest';
import {fromLocalInput, snapToQuarter, toLocalInput} from './timeframe';

// The picker's datetime-local fields are wall-clock in `timeZone`, so these two
// must round-trip regardless of the machine's own timezone.
describe('toLocalInput / fromLocalInput', () => {
  it('reads a wall-clock as Europe/Berlin in summer and winter', () => {
    expect(fromLocalInput('2026-08-01T18:30')?.toISOString()).toBe(
      '2026-08-01T16:30:00.000Z',
    );
    expect(fromLocalInput('2026-01-15T18:30')?.toISOString()).toBe(
      '2026-01-15T17:30:00.000Z',
    );
  });

  it('round-trips across the spring-forward gap', () => {
    // 02:30 local does not exist on 2026-03-29; whatever instant we resolve to
    // must render back to a wall-clock that resolves to the same instant.
    const instant = fromLocalInput('2026-03-29T02:30');
    expect(instant).not.toBeNull();
    const back = fromLocalInput(toLocalInput(instant!.getTime()));
    expect(back?.getTime()).toBe(instant!.getTime());
  });

  it('rejects an empty or partial field', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('2026-08-01')).toBeNull();
  });
});

// What the project timeline's thumbs snap to on release; the clamping and
// ordering built on top of it live in projectSelection.test.ts.
describe('snapToQuarter', () => {
  it('rounds to the nearest wall-clock quarter hour', () => {
    const at = (iso: string) =>
      new Date(snapToQuarter(Date.parse(iso))).toISOString();
    expect(at('2026-07-24T18:07:00.000Z')).toBe('2026-07-24T18:00:00.000Z');
    expect(at('2026-07-24T18:08:00.000Z')).toBe('2026-07-24T18:15:00.000Z');
    expect(at('2026-07-24T18:52:30.000Z')).toBe('2026-07-24T19:00:00.000Z');
  });

  // Berlin is a whole-hour offset from UTC, so snapping in absolute time also
  // lands on a local :00/:15/:30/:45 — that's what makes the simple math valid.
  it('lands on a local quarter hour too', () => {
    const local = toLocalInput(
      snapToQuarter(Date.parse('2026-07-24T18:08:00Z')),
    );
    expect(local.endsWith(':15')).toBe(true);
  });
});
