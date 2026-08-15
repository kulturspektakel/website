import {describe, expect, it} from 'vitest';
import {
  LABEL_SPACE,
  TICK_SPACE,
  axisFraction,
  timelineTicks,
  type TimelineTick,
} from './timelineTicks';
import {fmtHourMinute} from './chartUtils';

// The strip's time axis is a *calendar* grid, not a grid of milliseconds — which is
// what the two DST cases below are here to prove. Nothing pins a timezone for the test
// run, so every assertion reads either a UTC instant or the module's own label: a
// `new Date(ms).getHours()` would pass on a laptop in Berlin and fail on CI.

const at = (iso: string) => Date.parse(iso);
const isos = (ticks: TimelineTick[]) =>
  ticks.map((t) => new Date(t.ms).toISOString());
const labels = (ticks: TimelineTick[]) =>
  ticks.map((t) => t.label).filter((l): l is string => l != null);

// A four-day festival, which is the case the whole thing is sized for, at the two
// widths that bracket it: a phone with the toolbar's padding taken off, and a laptop.
const FESTIVAL = {
  start: at('2026-07-31T10:00:00Z'),
  end: at('2026-08-04T10:00:00Z'),
};
const PHONE = 319;
const DESKTOP = 1160;

// How far apart consecutive lines actually land on a strip that wide — the quantity the
// step is chosen to protect, so the one worth asserting on.
const gapsPx = (
  ticks: TimelineTick[],
  window: {start: number; end: number},
  widthPx: number,
) =>
  ticks
    .slice(1)
    .map(
      (t, i) => ((t.ms - ticks[i]!.ms) / (window.end - window.start)) * widthPx,
    );

describe('timelineTicks', () => {
  // The point of taking a width at all: the same festival has to read as four days on a
  // phone and as sixteen six-hour blocks on a laptop. A step keyed on the window alone
  // would draw one of those two badly.
  it('thins the grid to fit the pixels, not the window', () => {
    const phone = timelineTicks(FESTIVAL, PHONE);
    const desktop = timelineTicks(FESTIVAL, DESKTOP);

    // Six-hourly on the phone, two-hourly with nearly four times the room. The step is
    // the assertion; the count follows from it and the window, so saying both would be
    // two numbers to re-derive by hand for one fact.
    expect(phone[1]!.ms - phone[0]!.ms).toBe(6 * 60 * 60_000);
    expect(desktop[1]!.ms - desktop[0]!.ms).toBe(2 * 60 * 60_000);
  });

  // The spacing is chosen in calendar units and spent in real ones, and the two are not
  // the same: a stride containing a spring-forward day is an hour shorter than it reads.
  // So the floor a step can actually promise is the minimum less that hour — which only
  // bites at all when the step is whole days, where one hour is a rounding of it.
  it('never draws two lines closer than the minimum spacing', () => {
    for (const widthPx of [40, 100, 319, 640, 1160, 2400]) {
      for (const days of [0.05, 0.5, 1, 4, 30, 400]) {
        const window = {
          start: FESTIVAL.start,
          end: FESTIVAL.start + days * 86_400_000,
        };
        const hourPx = (3_600_000 / (window.end - window.start)) * widthPx;
        for (const gap of gapsPx(
          timelineTicks(window, widthPx),
          window,
          widthPx,
        )) {
          expect(gap).toBeGreaterThanOrEqual(TICK_SPACE - hourPx);
        }
      }
    }
  });

  // The day tier is not a second pass over the ticks: a line *is* the day marker when
  // its own wall clock reads midnight. So the two tiers cannot disagree about where a
  // day begins, and midnight is on the grid whatever step was picked.
  it('puts its lines on the festival-local wall clock', () => {
    const ticks = timelineTicks(FESTIVAL, PHONE);

    // Berlin is UTC+2 in summer, so local midnight is 22:00 the day before.
    expect(isos(ticks.filter((t) => t.major))).toEqual([
      '2026-07-31T22:00:00.000Z',
      '2026-08-01T22:00:00.000Z',
      '2026-08-02T22:00:00.000Z',
      '2026-08-03T22:00:00.000Z',
    ]);
    // And `major` is exactly that, never merely "the first tick of a run".
    for (const tick of ticks) {
      expect(tick.major).toBe(fmtHourMinute(tick.ms / 1000) === '00:00');
    }
  });

  it('stays inside the window it was given', () => {
    const ticks = timelineTicks(FESTIVAL, DESKTOP);
    expect(ticks[0]!.ms).toBeGreaterThanOrEqual(FESTIVAL.start);
    expect(ticks[ticks.length - 1]!.ms).toBeLessThanOrEqual(FESTIVAL.end);
  });

  // The hour that never happens. Building a tick from the day's calendar fields is what
  // keeps the grid on the clock across the change — but asking for 02:00 on the
  // spring-forward day hands back 01:00, so the naive walk emits the same instant twice
  // and labels one of them wrong. Hence the round-trip guard.
  it('skips the hour a spring-forward day does not have', () => {
    const window = {
      start: at('2026-03-28T22:00:00Z'),
      end: at('2026-03-29T22:00:00Z'),
    };
    const ticks = timelineTicks(window, 500);
    const clock = ticks.map((t) => fmtHourMinute(t.ms / 1000));

    expect(clock).toContain('01:00');
    expect(clock).not.toContain('02:00');
    expect(clock).toContain('03:00');
    // 01:00+01:00 is 00:00Z; the next line is 03:00+02:00, one real hour later.
    const i = clock.indexOf('01:00');
    expect(isos(ticks).slice(i, i + 2)).toEqual([
      '2026-03-29T00:00:00.000Z',
      '2026-03-29T01:00:00.000Z',
    ]);
    // The failure this guards against is a duplicate, so say so directly.
    expect(new Set(ticks.map((t) => t.ms)).size).toBe(ticks.length);
  });

  // The other side of it: a 25-hour day still has 24 wall-clock hours, and the repeated
  // 02:00 must resolve to one of them rather than to both — otherwise the grid runs
  // backwards.
  it('keeps a fall-back day on the clock and moving forwards', () => {
    const window = {
      start: at('2026-10-24T22:00:00Z'),
      end: at('2026-10-25T23:00:00Z'),
    };
    const ticks = timelineTicks(window, 500);

    expect(isos(ticks.filter((t) => t.major))).toEqual([
      '2026-10-24T22:00:00.000Z',
      '2026-10-25T23:00:00.000Z',
    ]);
    expect(ticks.map((t) => fmtHourMinute(t.ms / 1000))).toContain('02:00');
    for (const [i, tick] of ticks.slice(1).entries()) {
      expect(tick.ms).toBeGreaterThan(ticks[i]!.ms);
    }
  });

  // A label is a line that got one, never a position of its own — and the rule that
  // keeps it so is that the label step is a multiple of the tick step.
  it('labels lines and nothing between them', () => {
    for (const widthPx of [100, 319, 640, 1160]) {
      const ticks = timelineTicks(FESTIVAL, widthPx);
      const labelled = ticks.filter((t) => t.label != null);

      // Across a festival a date is only ever written on a day mark, and a time only
      // ever between two — there is no third position a label can take.
      for (const tick of labelled) {
        expect(tick.label).toMatch(
          tick.major ? /^\d{2}\.\d{2}\.$/ : /^\d{2}:\d{2}$/,
        );
      }
      for (const gap of gapsPx(labelled, FESTIVAL, widthPx)) {
        expect(gap).toBeGreaterThanOrEqual(LABEL_SPACE);
      }
    }
  });

  it('reads a phone-width festival as four dates and nothing else', () => {
    expect(labels(timelineTicks(FESTIVAL, PHONE))).toEqual([
      '01.08.',
      '02.08.',
      '03.08.',
      '04.08.',
    ]);
  });

  // Below that the dates themselves have to thin out, and the run starts at the first
  // day mark in view rather than on some calendar anchor off the left of the strip —
  // otherwise a strip this narrow can open on an unlabelled date.
  it('drops dates too, once four of them will not fit', () => {
    expect(labels(timelineTicks(FESTIVAL, 100))).toEqual(['01.08.', '03.08.']);
  });

  // A project that is one evening rather than a festival. It has no midnight to hang
  // anything on, so the tiers step down a unit: hours become the long marks and quarters
  // the notches between them. The threshold is the row charts' own (spanWithinDay), so
  // the strip stops naming dates at exactly the width their axis does.
  describe('within a single day', () => {
    // 18:00–23:00 Berlin, five hours — a stage's evening.
    const EVENING = {
      start: at('2026-08-01T16:00:00Z'),
      end: at('2026-08-01T21:00:00Z'),
    };

    it('marks the hours and notches the quarters', () => {
      const ticks = timelineTicks(EVENING, DESKTOP);

      expect(ticks[1]!.ms - ticks[0]!.ms).toBe(15 * 60_000);
      // Every hour is major, and nothing between one is.
      for (const tick of ticks) {
        expect(tick.major).toBe(fmtHourMinute(tick.ms / 1000).endsWith(':00'));
      }
      expect(ticks.filter((t) => t.major)).toHaveLength(6);
    });

    it('labels in times, never dates', () => {
      for (const widthPx of [100, 319, 640, DESKTOP]) {
        for (const label of labels(timelineTicks(EVENING, widthPx))) {
          expect(label).toMatch(/^\d{2}:\d{2}$/);
        }
      }
      expect(labels(timelineTicks(EVENING, DESKTOP))).toContain('18:00');
    });

    // The tier is decided by the window's width in time, not by whether it happens to
    // straddle a midnight — an evening that runs past one is still an evening.
    it('keeps the hour tier across a midnight it merely crosses', () => {
      // 22:00–02:00 Berlin, four hours over the turn of the day.
      const ticks = timelineTicks(
        {start: at('2026-08-01T20:00:00Z'), end: at('2026-08-02T00:00:00Z')},
        DESKTOP,
      );
      for (const tick of ticks) {
        expect(tick.major).toBe(fmtHourMinute(tick.ms / 1000).endsWith(':00'));
      }
      // Midnight is one of the hours, and reads as one rather than as a date.
      const midnight = ticks.find(
        (t) => fmtHourMinute(t.ms / 1000) === '00:00',
      );
      expect(midnight?.major).toBe(true);
      expect(labels(ticks).every((l) => /^\d{2}:\d{2}$/.test(l))).toBe(true);
    });

    // The boundary itself, which is where the two readings meet.
    it('hands back to days at exactly a day', () => {
      const dayLong = (ms: number) =>
        timelineTicks({start: EVENING.start, end: EVENING.start + ms}, DESKTOP);
      const DAY = 86_400_000;

      expect(
        labels(dayLong(DAY - 1)).every((l) => /^\d{2}:\d{2}$/.test(l)),
      ).toBe(true);
      expect(labels(dayLong(DAY)).some((l) => /^\d{2}\.\d{2}\.$/.test(l))).toBe(
        true,
      );
    });
  });

  // All ordinary states, not defensive padding: the strip renders on the server, where
  // there is no ResizeObserver to measure it, and the pickable window is clamped to the
  // current time — so a festival that has not opened yet is a window of zero width.
  it('draws nothing it cannot place', () => {
    expect(timelineTicks(FESTIVAL, 0)).toEqual([]);
    expect(timelineTicks(FESTIVAL, -1)).toEqual([]);
    expect(
      timelineTicks({start: FESTIVAL.start, end: FESTIVAL.start}, PHONE),
    ).toEqual([]);
    expect(
      timelineTicks({start: FESTIVAL.end, end: FESTIVAL.start}, PHONE),
    ).toEqual([]);
  });

  // An event is an evening to a long weekend, which is where the ladder stops. Dates
  // typed wrong can still hand this a year, and it should answer with a coarse axis
  // rather than a thousand lines.
  it('stays bounded for a window no event would have', () => {
    const ticks = timelineTicks(
      {start: at('2026-01-01T00:00:00Z'), end: at('2027-01-01T00:00:00Z')},
      PHONE,
    );

    expect(ticks.length).toBeLessThanOrEqual(PHONE / TICK_SPACE + 1);
    expect(ticks.every((t) => fmtHourMinute(t.ms / 1000) === '00:00')).toBe(
      true,
    );
  });
});

describe('axisFraction', () => {
  // Shared with the timeline's readout pill, so a tick and the thumb standing on it are
  // placed by one expression: two would disagree by a rounding, which is precisely what
  // a gridline makes visible.
  it('places a value between the ends, and clamps outside them', () => {
    expect(axisFraction(50, 0, 200)).toBe(0.25);
    expect(axisFraction(-10, 0, 200)).toBe(0);
    expect(axisFraction(999, 0, 200)).toBe(1);
  });
});
