import {describe, expect, it} from 'vitest';
import {
  assignmentsAt,
  createPlayheadSignal,
  type NoiseAssignment,
} from './projectView';
import {MINUTE_MS} from './timeframe';

// A location's monitors are a question about an instant, not about now: the loader
// ships the whole assignment history and the page resolves it as you scrub. These
// pin the boundary rule, because assignNoiseDevice deliberately closes one row and
// opens the next with a single shared `now` — so two assignments meet exactly, and
// exactly one of them may match.

const MOVED_AT = Date.parse('2026-07-25T18:00:00Z');

const assignment = (
  id: string,
  start: number,
  end: number | null,
): NoiseAssignment => ({id, deviceId: `dev-${id}`, start, end, lastSeen: null});

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
