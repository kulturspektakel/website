import {describe, expect, it} from 'vitest';
import {
  assignmentsAt,
  createPlayheadSignal,
  locationLines,
  overlappingAssignments,
  type NoiseAssignment,
  type NoiseLocationItem,
} from './projectView';
import {MINUTE_MS} from './timeframe';

// A location's monitors are a question about an instant, not about now: the loader
// ships the whole assignment history and the page resolves it as you scrub. These
// pin the boundary rule, which a handover relies on: a monitor moved at 18:00 has one
// window ending there and the next beginning there, and exactly one of them may match.

const MOVED_AT = Date.parse('2026-07-25T18:00:00Z');

const assignment = (
  id: string,
  start: number,
  end: number | null,
  deviceId = `dev-${id}`,
  // Every window here is an explicit one: what a blank start means is the loader's business
  // (it resolves it to the event's), and by the time these functions see a row it is an
  // instant like any other.
): NoiseAssignment => ({
  id,
  deviceId,
  start,
  startsWithProject: false,
  end,
  lastSeen: null,
});

// One monitor stood here until 18:00, another took over at exactly 18:00.
const before = assignment('a', Date.parse('2026-07-25T12:00:00Z'), MOVED_AT);
const after = assignment('b', MOVED_AT, null);
const history = [before, after];

describe('assignmentsAt', () => {
  it('reads live mode as the assignments still open', () => {
    expect(assignmentsAt(history, null)).toEqual([after]);
  });

  it('resolves the monitor that stood there at the instant', () => {
    expect(assignmentsAt(history, MOVED_AT - MINUTE_MS)).toEqual([before]);
    expect(assignmentsAt(history, MOVED_AT + MINUTE_MS)).toEqual([after]);
  });

  // The load-bearing case: start inclusive, end exclusive, so the shared instant
  // belongs to the new assignment alone. Both matching would double a location's
  // rows and make its pin ambiguous.
  it('gives the shared instant to exactly one of two abutting assignments', () => {
    expect(assignmentsAt(history, MOVED_AT)).toEqual([after]);
  });

  it('is empty before anything was assigned', () => {
    expect(assignmentsAt(history, before.start - MINUTE_MS)).toEqual([]);
  });

  it('is empty for a location that stood empty at that instant', () => {
    const gap = [assignment('a', 0, 10), assignment('b', 20, null)];
    expect(assignmentsAt(gap, 15)).toEqual([]);
  });

  it('is empty for a location with no assignments at all', () => {
    expect(assignmentsAt([], null)).toEqual([]);
    expect(assignmentsAt([], MOVED_AT)).toEqual([]);
  });

  // A location can hold several monitors at once, and the loudest is what its pin
  // carries — so this returns all of them, not the first match.
  it('returns every monitor standing there at once', () => {
    const both = [assignment('a', 0, null), assignment('b', 0, null)];
    expect(assignmentsAt(both, 5)).toHaveLength(2);
    expect(assignmentsAt(both, null)).toHaveLength(2);
  });

  // An assignment made after a finished project's end: live mode must still show it,
  // which is why the loader doesn't window-filter the history.
  it('shows an assignment that starts after the project window', () => {
    const late = assignment('c', Date.parse('2030-01-01T00:00:00Z'), null);
    expect(assignmentsAt([late], null)).toEqual([late]);
    expect(assignmentsAt([late], MOVED_AT)).toEqual([]);
  });
});

// What turns a location's assignment history into the lines of its chart. The masking
// itself is series.ts' maskToWindows; this only decides how many lines there are and
// which stretches belong to each.
describe('locationLines', () => {
  it('makes one line per monitor, in the order the place first had them', () => {
    const lines = locationLines([
      assignment('b', 200, null, 'dev-2'),
      assignment('a', 100, 200, 'dev-1'),
    ]);
    expect(lines.map((l) => l.deviceId)).toEqual(['dev-1', 'dev-2']);
  });

  // The case the grouping exists for: a monitor carried off and brought back is still
  // one monitor, so its two stints are two windows on one line rather than two lines.
  it('gathers a monitor’s stints onto one line', () => {
    const lines = locationLines([
      assignment('a', 0, 100, 'dev-1'),
      assignment('b', 300, null, 'dev-1'),
    ]);
    expect(lines).toEqual([
      {
        deviceId: 'dev-1',
        lastSeen: null,
        windows: [
          {start: 0, end: 100},
          {start: 300, end: null},
        ],
      },
    ]);
  });

  // A location nothing has stood at yet: no lines, which is what the chart draws its
  // empty axes for rather than the card omitting the chart.
  it('is empty for a location with no history', () => {
    expect(locationLines([])).toEqual([]);
  });
});

// The dialog's warning, and the only thing standing where the server's "one open row
// per device" rewrite used to: nothing stops a window being typed over another now, so
// these pin what counts as over.
describe('overlappingAssignments', () => {
  const place = (
    id: string,
    assignments: NoiseAssignment[],
  ): NoiseLocationItem => ({
    id,
    locationName: `Bühne ${id}`,
    latitude: 0,
    longitude: 0,
    assignments,
  });

  it('does not clash two abutting windows', () => {
    expect(overlappingAssignments(after, 'a', [place('a', history)])).toEqual(
      [],
    );
  });

  it('warns the later of two monitors standing at one location at once', () => {
    const first = assignment('a', 0, 100);
    const second = assignment('b', 50, 150);
    const locations = [place('a', [first, second])];
    expect(overlappingAssignments(second, 'a', locations)).toEqual([
      {locationName: 'Bühne a', assignment: first},
    ]);
    // …and only the later one, or one mistake would print two red lines.
    expect(overlappingAssignments(first, 'a', locations)).toEqual([]);
  });

  it('warns when the same monitor stands at two locations at once', () => {
    const here = assignment('a', 0, 100, 'dev-1');
    const elsewhere = assignment('b', 50, 150, 'dev-1');
    const locations = [place('a', [here]), place('b', [elsewhere])];
    // Reported on the earlier row too — the other one isn't in this dialog to carry it.
    expect(overlappingAssignments(here, 'a', locations)).toEqual([
      {locationName: 'Bühne b', assignment: elsewhere},
    ]);
  });

  it('ignores a different monitor at a different location', () => {
    const locations = [
      place('a', [assignment('a', 0, 100, 'dev-1')]),
      place('b', [assignment('b', 0, 100, 'dev-2')]),
    ];
    expect(
      overlappingAssignments(locations[0].assignments[0], 'a', locations),
    ).toEqual([]);
  });

  // Two rows that never close, which is exactly what dropping the server-side rewrite
  // made possible — and never true, however long ago the festival ended.
  it('clashes two open windows for one monitor', () => {
    const here = assignment('a', 0, null, 'dev-1');
    const later = assignment('b', 999, null, 'dev-1');
    const locations = [place('a', [here]), place('b', [later])];
    expect(overlappingAssignments(here, 'a', locations)).toHaveLength(1);
  });
});

// The playhead is the one piece of page state that moves on every animation frame, so
// it travels as a subscription rather than as a context value — see createPlayheadSignal.
// These pin the two properties the row charts depend on: that a subscriber is told
// where the line stands the moment it registers, and that an unchanged instant is not
// an event.
describe('createPlayheadSignal', () => {
  it('tells a new subscriber where the playhead already stands', () => {
    const signal = createPlayheadSignal();
    signal.set(MOVED_AT);
    const seen: Array<number | null> = [];
    signal.subscribe((at) => seen.push(at));
    expect(seen).toEqual([MOVED_AT]);
  });

  it('starts at no instant at all', () => {
    const seen: Array<number | null> = [];
    createPlayheadSignal().subscribe((at) => seen.push(at));
    expect(seen).toEqual([null]);
  });

  it('says nothing when the instant has not moved', () => {
    const signal = createPlayheadSignal();
    const seen: Array<number | null> = [];
    signal.subscribe((at) => seen.push(at));
    signal.set(MOVED_AT);
    signal.set(MOVED_AT);
    signal.set(MOVED_AT + MINUTE_MS);
    signal.set(null);
    expect(seen).toEqual([null, MOVED_AT, MOVED_AT + MINUTE_MS, null]);
  });

  it('stops telling a subscriber that has unsubscribed', () => {
    const signal = createPlayheadSignal();
    const seen: Array<number | null> = [];
    const unsubscribe = signal.subscribe((at) => seen.push(at));
    unsubscribe();
    signal.set(MOVED_AT);
    expect(seen).toEqual([null]);
  });
});
