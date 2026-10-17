import {isRangeKey} from './level';
import {type LimitLine} from './limitLines';
import {type RangeLeq} from './projectLogs';

// A stretch something on a location's page defines, which its `Leq,T` is read over: a
// comment with an end (a band's set, say), or a `Leq,T` limit's hours. `limit` is the limit
// when the stretch is one, which is what judges its `Leq,T` (see rangeLeqs).
export type NamedRange = {
  id: string;
  start: number;
  end: number;
  limit?: LimitLine;
};

// A range with what a place came to over it, per weighting (see rangeLeqs) — what the card's
// tile prints.
export type RangeReading = NamedRange & {leqs: readonly RangeLeq[]};

// The ranges of one place: its comments that have an end, and the hours of every limit
// written against a `Leq,T`. Not a limit on a series: its
// hours bound a level, which says nothing about the Leq over them. `comments` are the ones
// reaching the place (see locationTags), the same ones its chart labels.
export function locationRanges(
  comments: readonly {
    id: string;
    start: number;
    end: number | null;
  }[],
  limits: readonly LimitLine[],
): NamedRange[] {
  return [
    ...comments.flatMap(({id, start, end}) =>
      end == null ? [] : [{id, start, end}],
    ),
    ...limits.flatMap((limit, i) =>
      isRangeKey(limit.series)
        ? [
            {
              id: `limit:${i}`,
              start: limit.start,
              end: limit.end,
              limit,
            },
          ]
        : [],
    ),
  ];
}

// Every range an instant (epoch ms) is in, `[start, end)` like every window on the page.
const rangesAt = <R extends {start: number; end: number}>(
  ranges: readonly R[],
  at: number,
): R[] => ranges.filter((r) => r.start <= at && at < r.end);

// The shortest range an instant is in — the most specific thing it is part of, a band's set
// rather than the evening around it — or null outside every one. The one rule the card's
// tile and the timeline's pill both pick a comment by.
export const innermostAt = <R extends {start: number; end: number}>(
  ranges: readonly R[],
  at: number,
): R | null =>
  rangesAt(ranges, at).sort((a, b) => a.end - a.start - (b.end - b.start))[0] ??
  null;

/**
 * The one range a card's tile reads at an instant, of however many it is in: a `Leq,T`
 * limit first, the strictest — so the tile turns red where the permit is broken, which is
 * the one thing about a range a glance along the cards must not miss — and otherwise the
 * innermost comment (see innermostAt). Null outside them, where the tile is not shown.
 */
export function activeRange(
  ranges: readonly NamedRange[],
  at: number,
): NamedRange | null {
  // Every limit here is a `Leq,T` one (see locationRanges).
  const judged = rangesAt(ranges, at)
    .filter((r) => r.limit != null)
    .sort((a, b) => a.limit!.decibels - b.limit!.decibels);
  return (
    judged[0] ??
    innermostAt(
      ranges.filter((r) => r.limit == null),
      at,
    )
  );
}
