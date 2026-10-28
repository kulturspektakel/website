import {Box, HStack, Text} from '@chakra-ui/react';
import {type ComponentProps, useMemo} from 'react';
// The one icon in this section that isn't lucide's, for two reasons: lucide is a stroke-only
// set, and at the size this sits — 12px, inside a badge — an outlined triangle is a few
// hairlines that read as a smudge. Heroicons' *mini* set is drawn for exactly this size, on a
// 20px grid with the corners rounded and the "!" knocked out by fill-rule rather than by
// winding — so it stays a warning sign rather than becoming a solid lozenge.
import {HiMiniExclamationTriangle} from 'react-icons/hi2';
import {LuChevronDown, LuChevronUp} from 'react-icons/lu';
import {Tooltip} from '../chakra-snippets/tooltip';
import {useDeviceStates, useTick} from './context';
import {
  displayedLevel,
  formatDb,
  isCurrent,
  loudestLevel,
  rangeKey,
  rangeLabel,
  seriesLabel,
  type DisplayedLevel,
  type PickedSeries,
} from './level';
import {seriesByKey, SERIES} from './series';
import {type ChartSeriesToken} from '../../theme-noise';
import {coverageDetail} from './leq';
import {IGNORED_OPACITY} from './rangeTags';
import {exceedsLimit, limitAt, type LimitLine} from './limitLines';
import {type PlayheadLevels} from './projectLogs';
import {
  LIMIT_STATE_NAME,
  currentKey,
  limitBeatAnimation,
  forecasts,
  glowShadow,
  limitGlow,
  limitStateOf,
  type LimitLightState,
} from './limitState';
import {type RangeReading} from './ranges';
import {type NoiseAssignment} from './projectView';

// How loud it is at a location — the other half of its header, the half that follows the
// playhead. Which monitors have stood there is the badges beside it (see DeviceBadge);
// this was once the same component as those, back when a location was one row per device
// standing at it, and neither half speaks for a device any more.

// How loud it is *here*: one reading per series the page is drawing, then what the whole
// crop averaged. Levels and nothing else — whether a monitor is still talking, and since when
// if it isn't, belongs to that monitor's badge (see DeviceBadge).
//
// Every number is the location's rather than a monitor's, and they are two shapes of the
// same rule, "the loudest of whatever is here":
//
//   the instant — for each picked series, the loudest of the monitors assigned at the
//                 playhead, resolved the same way and by the same loudestLevel a map pin
//                 uses, so the card and the pin for one place can no longer print
//                 different numbers.
//   a range     — the energetic mean of that loudest, minute by minute, over the stretch
//                 the playhead is in or a sweep names (see activeRange), in each weighting
//                 of the picked series — and no tile at all outside every range.
//
// One tile each, in the picker's order — which is the chart's order too (see SERIES) — the
// value over the quantity's own name, `LAeq,5m` under 98.0. Naming it is what a row of
// tagged figures could not do at that width: five of "87.5 dB(A) 5m" is the unit said five
// times, and dropping the unit to fit left a run of numbers identified only by their colour.
// Under a name the unit goes unsaid because the name implies it, and the colour is left to do
// what it does on the chart — tie the number to its line.
//
// The name is doing more work than it was: a kind's two weightings share a colour, so with
// both picked the tiles for `LAeq,5m` and `LCeq,5m` are the same shade and it is the letter
// in the middle that tells them apart. Which is the same thing that tells their two lines
// apart on the chart, and why the tooltip there prints the name in full too.
//
// The loudest is taken per series rather than once: each of these is a self-contained
// "loudest of whatever is here, in this series", the same question the pin asks, asked
// once per line. Only a composite reading — a number and the coverage that qualifies it —
// has to come off a single monitor (see loudestIndex).
//
// A monitor named in the header but not standing here at the playhead contributes to
// none of them: its readings from wherever it went are not this location's.

// One tile of the row, ready to print: the level, the name that goes under it, and the shade
// it is drawn in — its line's.
type PrintedLevel = {
  key: string;
  level: DisplayedLevel;
  label: string;
  color: ChartSeriesToken | 'chart.range';
  // What qualifies the number, for the one tile that has anything to qualify it — the
  // coverage behind the crop's mean. Carried by the tile rather than as a flag saying
  // "I am the last one", which is a claim about position that reordering the row would
  // silently make false.
  caveat?: string;
  // A reading of monitors crew tagged to be ignored at this instant: printed, but struck
  // through and faded, so it is still there to read and plainly not counted.
  ignored?: boolean;
  // The limit in force for this series at the instant being read, and whether the reading
  // is over it — absent for the crop's mean, which no limit is written against.
  limitDb?: number | null;
  over?: boolean;
  // Where the reading stands against that limit, as the badge's glow and chevron say it
  // (see ReadingTile) — absent where no limit is in force, null where there is one but
  // nothing current to judge.
  limitState?: LimitLightState | null;
};

// The badge's corner, and the corner of the box inside it. Concentric, which means the
// inner one is the outer less the frame between them — curve both by the same
// radius and the frame reads as thickening at the corners. In `em`, like every size in the
// badge, so the whole of it scales with the row's type (see ReadingTiles).
const BADGE_RADIUS = '0.375em';
// The frame — the badge's colour showing round the number — scaling with the rest of it, but
// never thinner than a hairline: 1px on a card, growing to 2px at the device page's largest.
const BADGE_FRAME = 'max(1px, 0.0625em)';
const INNER_RADIUS = `calc(${BADGE_RADIUS} - ${BADGE_FRAME})`;

// The type a row of badges is set in, which every size inside a badge is relative to: the
// card header's at 1.125rem — a step over the body text, so the readings are what a glance
// along the cards lands on — and the device page's, where the badges are the page's
// headline numbers, growing with the viewport to twice the body text.
const TILE_SIZES = {
  sm: '1.125rem',
  lg: 'clamp(1rem, 0.5rem + 2vw, 2rem)',
} as const;

// A row that fills the box it is in rather than being set at a size (`size="fit"`): the
// device page's, whose height the person reading it drags (see LiveView). Sized off the box
// with container query units — so the box has to be a size container — as large as both of
// its sides allow: tall enough to fill the height, and no wider in total than the width,
// since a row that wrapped would be twice the height it was sized for. Never under the body
// text's 1rem.
//
// The two divisors are what one badge measures in its own type: about 2.6em tall (the
// number's line, the name's and the frame — see ReadingTile) with a hair to spare, and about
// 5.75em wide with its share of the gaps and room for a sign
// beside the number. Estimates, and erring large: what they get wrong is some empty space,
// not a badge cut off.
const FIT_HEIGHT_EM = 2.7;
const FIT_WIDTH_EM = 5.75;
const fitFontSize = (count: number): string =>
  `max(1rem, min(calc(100cqh / ${FIT_HEIGHT_EM}), calc(100cqw / ${Math.max(1, count) * FIT_WIDTH_EM})))`;

// The most badges a row may put on one line, per breakpoint — the cap that makes five of
// them fall onto a second row on a narrow card (see the grid below for why a cap rather
// than wrapping).
const GRID_CAPS = {base: 2, sm: 3, lg: Infinity} as const;

// The grid a row of `n` badges is laid out in, for every count this can print: the picked
// series, at most the whole table's worth, and the crop's mean in each weighting after them.
//
// A table rather than three template literals built where the Box is: this component
// re-renders at least once a second from its own tick, and again on every animation frame
// of a crop drag through the context, per card on the page — and the answer is a pure
// function of a number between one and six. Hoisted for the same reason MARKERS_CSS and
// CHART_CSS are, one file over: Emotion resolves it once for the session rather than
// hashing a fresh object per card per frame.
const GRID_COLUMNS = Array.from(
  {length: SERIES.length + 3},
  (_, n) =>
    ({
      base: `repeat(${Math.min(n, GRID_CAPS.base)}, 1fr)`,
      sm: `repeat(${Math.min(n, GRID_CAPS.sm)}, 1fr)`,
      lg: `repeat(${n}, 1fr)`,
    }) as const,
);

export function LocationReadings({
  assignments,
  range,
  levels,
  live,
  picked,
  ignored,
  limits,
  at,
}: {
  // The monitors standing here at the instant being viewed — which while live means the
  // ones standing here now. Not the location's whole history: that is what the names
  // above and the chart below are drawn from, and averaging a monitor's time at another
  // stage into this place's reading is the mistake this shape exists to prevent.
  assignments: NoiseAssignment[];
  // This location's `Leq,T` over the range the playhead is in (see activeRange), one
  // badge per weighting, with the range's name — nothing at all outside every range, and
  // while live, when an instant has no range to average over. The caller decides what is
  // asked for, and this prints whatever it is given.
  range?: RangeReading;
  // What the playhead's minute holds for each monitor, series by series, from the
  // project's logs. Undefined while live and while the one query behind it is in flight.
  levels?: PlayheadLevels;
  // Which numbers to show is decided by displayedLevel, shared with the map pins.
  live: boolean;
  // Every series the page is showing — one number each, in that line's colour. The whole
  // set and not just the primary: what the picker asks for is a comparison (dB(A) against
  // dB(C), the minute Leq against LAFmax, the 5m against the 30m), and the charts having
  // drawn it while the header printed one of them made the numbers the odd half of the
  // answer.
  picked: PickedSeries;
  // Which of `assignments`' monitors are tagged to be ignored at the instant being read.
  // Left out of the loudest; when that is all of them, the tiles show what they read
  // anyway, marked as ignored — the same rule the map pin follows.
  ignored: ReadonlySet<string>;
  // The place's permit, and the minute the readings are of (see useReadingMinute) — what
  // each series' tile is judged against, by the same rule the map's pins and the chart's
  // tooltip use (see limitAt, exceedsLimit). Null before the playhead has been placed.
  limits: readonly LimitLine[];
  at: number | null;
}) {
  // One wake-up for the header's whole set — a location's two monitors are read
  // together and printed as one reading, so there is nothing to gain from rendering
  // them apart.
  const deviceState = useDeviceStates(assignments.map((a) => a.deviceId));
  // Local tick: freshness is per-card, so this doesn't re-render its siblings.
  const now = useTick();

  const allIgnored =
    assignments.length > 0 && assignments.every((a) => ignored.has(a.deviceId));
  const counted = allIgnored
    ? assignments
    : assignments.filter((a) => !ignored.has(a.deviceId));

  // Every tile this header prints, in the order it prints them: the picked series at the
  // playhead, then the crop. Built as one list because what the row does with them is the
  // same either way, and because whether anything here is a reading of now is a question
  // about the row rather than about any one of them.
  //
  // A series the page is drawing gets its badge whether or not there is anything in it: what
  // is picked is picked, and a monitor that hasn't filled its 30-minute buffer yet, or a
  // minute nobody reported, is a badge standing empty rather than one that isn't there. The
  // row then holds still as the playhead crosses a gap, instead of shuffling the badges
  // beside it along and back again.
  const printed: PrintedLevel[] = [
    ...picked.map((series) => {
      const level = loudestLevel(
        counted.map((a) =>
          displayedLevel({
            live,
            now,
            series,
            state: deviceState(a.deviceId),
            historyDb: levels?.[series]?.[a.deviceId],
          }),
        ),
      );
      const limitDb = at == null ? null : limitAt(limits, series, at);
      // The level this series is heading towards, for one that can be said to be heading
      // anywhere (see forecasts): the loudest of the same monitors in the shortest Leq of
      // its weighting — the second just gone live, the stored minute otherwise. Null where
      // that series hasn't been read, which leaves the badge only red or plain.
      const heading = forecasts(series)
        ? loudestLevel(
            counted.map((a) =>
              displayedLevel({
                live,
                now,
                series: currentKey(series),
                state: deviceState(a.deviceId),
                historyDb: levels?.[currentKey(series)]?.[a.deviceId],
              }),
            ),
          )
        : null;
      return {
        key: series,
        level,
        limitDb,
        // Judged against the strictest limit in force, which is the one the badge's worst
        // state comes from; and only on a reading of the instant being viewed that is being
        // counted — the same two conditions `over` has.
        limitState:
          limitDb == null
            ? undefined
            : !allIgnored && isCurrent(level)
              ? limitStateOf(
                  level.db,
                  heading && isCurrent(heading) ? heading.db : null,
                  limitDb,
                )
              : null,
        // Only a reading of the instant being viewed, and one that is being counted — the
        // same two conditions the map's pin warns under.
        over:
          !allIgnored && isCurrent(level) && exceedsLimit(level.db, limitDb),
        // The quantity spelled out — `LAeq,5m` — off the series table's own naming, and
        // in the mode's own window (a second live, a stored minute; see seriesLabel).
        label: seriesLabel(series, live),
        // Straight from the series table too, the one place a level's colour is decided,
        // so a number and the line it was read off cannot end up different shades.
        color: seriesByKey(series).color,
        ignored: allIgnored,
      };
    }),
    // Last, and hard against the edge of the card: a range's mean lines up in one column
    // down the page, whatever is picked above it. Named for the range where the others
    // name a window, because that is what it averages.
    //
    // One per weighting read, and only while the playhead is in a range (see activeRange).
    // A mean or no mean at all: there is nothing here that could be stale.
    //
    // Its caveat is also the coverage, because a Leq over a range is an average of the minutes
    // that were measured and how many there were is part of the reading: without it a place
    // monitored for two minutes of an hour is indistinguishable from one monitored
    // throughout. Measured against the minutes a monitor was assigned *here*, so an empty
    // stretch is the location's gap and not charged to the monitor that covered the rest.
    // Same rule as the device page's Leq tile, thresholds included, so a shortfall too small
    // to matter stays unsaid in both.
    ...(range?.leqs ?? []).map((leq) => ({
      key: rangeKey(leq.weighting),
      level: {kind: 'history', db: leq.db} as const,
      label: leq.label,
      // A light neutral off the series ramp, since it is the mean of a stretch rather than
      // a reading off any one window.
      color: 'chart.range' as const,
      // By the device page's rule, how much of the range was measured — said only where
      // minutes are missing.
      caveat: coverageDetail(leq),
      // Judged only where the stretch is a `Leq,T` limit's own hours (see rangeLeqs). A
      // mean over hours that are already the limit's has nowhere to be heading, so red or
      // nothing — the same glow the windows have, rather than a badge turned red.
      limitDb: leq.limit,
      over: exceedsLimit(leq.db, leq.limit),
      limitState:
        leq.limit == null ? undefined : limitStateOf(leq.db, null, leq.limit),
    })),
  ];

  return (
    // Side by side rather than stacked: they are several readings of one place at one instant,
    // not a headline and its footnotes. And never squashed: what gives when the header runs out
    // of width is the device names beside it, which truncate. One width for all of them, the
    // widest's — which is the crop's `LAeq,T` where it is shown (see ReadingTiles).
    //
    // Only the readings, and nothing about the monitors: when one was last heard from is a
    // fact about *that monitor*, so it is on its own badge (see DeviceBadge). Said here, once,
    // it was the newer monitor's silence reported for both of a card's two — and a clock under
    // a column of levels reads as one of them.
    <ReadingTiles
      tiles={printed.map(({level, ...tile}) => ({
        ...tile,
        db: level.kind === 'none' ? null : level.db,
        // Muted when the number is only the last thing we heard, so a reading that has
        // stopped moving doesn't keep reading as one that hasn't — saying "not now" then
        // matters more than which line it belongs to.
        color: level.kind === 'stale' ? 'fg.subtle' : tile.color,
      }))}
    />
  );
}

// A row of readings as badges — a location card's header, and the device page's row above
// its trace (see LiveView), which print the same kind of number and so print it the same way.
//
// A grid of equal columns rather than a row of badges, which is what makes them all one width
// without that width being written down anywhere: `1fr` tracks in a box sized by its own
// contents come out equal, and equal to the widest of them — so the longest name sets the size
// of every badge, and renaming it resizes them rather than clipping one.
//
// The column count is capped so the badges fall onto a second row where five of them would
// not fit a narrow box: a grid does not wrap, and this is what a wrapping row's line breaks
// would have done, decided by the space there is rather than found by the browser. Fewer
// badges than the cap is simply fewer columns.
//
// One component at two sizes: `size` sets the row's type, and everything in a badge is in
// `em` of it — so a larger row is the same badge scaled, not a second design kept in step.
//
// `spread` lays them across the whole width instead, each at its own width with the room
// left over shared out evenly between them and at both ends — the device page, where the row
// is the page's headline rather than a corner of a card's. Wrapping where they do not fit,
// which is what the grid's caps do for a card.
export function ReadingTiles({
  tiles,
  size = 'sm',
  spread = false,
}: {
  tiles: readonly ({key: string} & ComponentProps<typeof ReadingTile>)[];
  size?: keyof typeof TILE_SIZES | 'fit';
  spread?: boolean;
}) {
  const fit = size === 'fit';
  return (
    <Box
      {...(spread
        ? {
            display: 'flex',
            // Sized so it never has to wrap when it fills its box (see fitFontSize).
            flexWrap: fit ? 'nowrap' : 'wrap',
            justifyContent: 'space-evenly',
          }
        : {
            display: 'grid',
            gridTemplateColumns: GRID_COLUMNS[tiles.length],
          })}
      gap="0.375em"
      fontSize={fit ? fitFontSize(tiles.length) : TILE_SIZES[size]}
      flexShrink="0"
    >
      {tiles.map(({key, ...tile}) => (
        <ReadingTile key={key} {...tile} />
      ))}
    </Box>
  );
}

// One level as a small badge: the number on the ground, and under it, on the line's own
// colour, the name of what the number is.
//
// The line's colour is the badge rather than the number's ink, which is the point of the
// shape: a legend is a swatch beside a name, and this is that swatch with the reading in it.
// The number keeps the colour too, on the section's ground so it stays a level and not a
// label — the darkest thing on the card is where the numbers are read, the way it is on the
// chart below.
//
// Not the section's Chip, though it is the same size and sits in a row under a line of them
// (see DeviceBadge). A chip is a solid label in one colour with the section's own fill; this
// is two rows in two, and building it out of a Badge meant overriding the fill, the gap and
// the direction that make a Chip a Chip.
//
// Right-aligned throughout, because the tiles are: the readings hang off the end of the
// header, and a number is compared with the one above it down the page.
//
// Nothing here is pressable — the windows on show are chosen page-wide, in the toolbar, and a
// tile that looked like a toggle would promise that pressing it changed this one card. The
// exception is a badge with something to caveat, which is focusable so its warning can be
// read without a pointer.
function ReadingTile({
  db,
  label,
  color,
  caveat,
  ignored = false,
  limitDb,
  over = false,
  limitState,
}: {
  // The level, or null where this window has nothing at the instant being viewed — an empty
  // badge, keeping its place and its name.
  db: number | null;
  // What the number is — `LAeq,5m`, or the timeframe for the one averaged over all of it.
  label: string;
  // The line's shade.
  color: string;
  // The coverage shortfall, spelled out, where there is one worth saying — which puts the
  // yellow sign on the badge.
  caveat?: string;
  // Tagged to be ignored: the badge fades, the way its line does on the chart, and the
  // number is struck through.
  ignored?: boolean;
  // The limit in force for this reading, which an over-limit badge prints; and whether the
  // number is over it, which turns the whole badge red — the same red the chart washes a
  // breach in.
  limitDb?: number | null;
  over?: boolean;
  // Where this reading's place stands against its limit — over, recovering, heading over or
  // clear (see judgeLimit) — said as a glow into the number's well from its edges, red when
  // over and amber when heading over, and an arrow beside the number for the way it is
  // heading when that is not where it already is; nothing at all when clear (see
  // limitGlow). Null for a limit with nothing current to judge, which is no
  // glow either. Absent for a reading nobody asked this of: only the device page does, where the
  // badges are the instrument's headline. Where it is given it is the whole of what the
  // badge says about the limit — `over` no longer turns it red, so the two never disagree.
  limitState?: LimitLightState | null;
}) {
  // What hovering the badge says: the coverage behind the crop's mean, or where the reading
  // stands against its limit, in words. Not the limit's figure: an over-limit badge prints
  // that itself (see OverLimitLabel), and what the hover is for is the half the glow can
  // only hint at — whether it is on its way back, or on its way over. Where nobody asked for
  // the state, only whether it is over. Nothing for a reading below its limit and staying
  // there, which is the badge with nothing to say about its limit; nor where there is
  // nothing current to judge.
  const state =
    limitState === undefined
      ? limitDb != null && over
        ? 'over'
        : null
      : limitState;
  const tooltip = [
    caveat,
    state && state !== 'ok' ? LIMIT_STATE_NAME[state] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // The sign says one thing only: minutes missing from the mean. Over a limit is said by the
  // badge's colour (below), so the two never compete for the one glyph.
  const sign = caveat ? 'yellow.300' : null;
  // Over its limit the whole badge turns red — frame, name row and number — so a card over
  // its permit is found by glancing along the cards rather than by reading each figure. The
  // name still says which reading it is.
  const shade = over && limitState === undefined ? 'chart.limit' : color;
  const glow = limitState ? limitGlow(limitState) : null;
  // On the limit's beat, and in phase with every other badge's (see limitBeatAnimation) —
  // each started afresh only when what it is changes.
  const pulse = useLimitBeat(glow?.pulse ? 'limitPulse' : null);
  const drift = useLimitBeat(
    glow?.direction === 'up'
      ? 'limitDriftUp'
      : glow?.direction === 'down'
        ? 'limitDriftDown'
        : null,
  );
  const badge = (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="stretch"
      rounded={BADGE_RADIUS}
      overflow="hidden"
      // A floor under the equal columns, not a width: the grid still sizes them to the
      // widest name (see the caller), and this only stops a card whose readings are all
      // short names from shrinking its badges below the size a number is read at.
      minW="4.375em"
      // The colour is the badge, and the hairline of it left showing around the number is
      // what makes the two rows one object rather than a number with a bar under it.
      bg={shade}
      p={BADGE_FRAME}
      // Ignored, the whole badge fades by the amount its line does on the chart below.
      opacity={ignored ? IGNORED_OPACITY : undefined}
      textAlign="right"
      // The badge gives back four pixels at the bottom: the header's height is set by the
      // tallest thing in it, and a row of these was making the card taller than the name and
      // the monitors beside them need — the chart underneath is what wants that height.
      mb="-0.25em"
      // An instrument's readout, not copy: dragging across a row of them selected a run of
      // digits and names, and the text cursor over one promised a field. The plain arrow,
      // unless the badge has a hover to give (below).
      userSelect="none"
      cursor="default"
      {...(tooltip && {
        // A hover target the size of the badge, rather than a sign inside it to hit: the
        // caveat is about this reading, so the reading is what carries it. Focusable for the
        // same reason the sign used to be — a warning nobody can read is worse than none —
        // and `help` rather than `pointer`, which would promise it did something.
        as: 'button' as const,
        type: 'button' as const,
        'aria-label': tooltip,
        cursor: 'help',
        focusRing: 'outside' as const,
      })}
    >
      {/* Air above and below the number — the badge is read as a number first, and the ground
          it sits on is what gives it room to be one. */}
      <Box
        bg="bg"
        px="0.375em"
        py="0.125em"
        roundedTop={INNER_RADIUS}
        position="relative"
      >
        {/* The limit's state, glowing in from the well's edges round the number — light from
            outside the display falling into it. A layer of its own, under the number, so the
            light never sits over the digits and a pulse breathes the light and never them. */}
        {glow && (
          <Box
            position="absolute"
            inset="0"
            rounded="inherit"
            pointerEvents="none"
            boxShadow={glowShadow(glow.color)}
            transition="box-shadow 0.3s"
            // Breathing while the reading is heading the other way, in step with the
            // chevron's travel — and steady for anyone who asked for less motion.
            animation={pulse}
            _motionReduce={{animation: 'none'}}
          />
        )}
        {/* The sign goes to the far left, where it is out of the numbers' way: they line up
            on the right edge of the badge and down the page, and a sign between them and
            that edge would push the one card that has it out of the column. The limit's
            arrow takes the same place, for the same reason, and in the glow's colour — the
            two are one statement about one limit. */}
        <HStack
          gap="0.375em"
          justify="space-between"
          minW="0"
          position="relative"
        >
          {glow?.direction && (
            // Travelling the way it points (see limitDriftUp/Down in the crew theme), so
            // the direction is read from the motion as well as the shape. Still for anyone
            // who asked for less motion: the chevron alone says it.
            <Box
              color={glow.color}
              fontSize="0.875em"
              lineHeight="1"
              flexShrink="0"
              position="relative"
              top="1px"
              aria-hidden
              animation={drift}
              _motionReduce={{animation: 'none'}}
            >
              {glow.direction === 'up' ? <LuChevronUp /> : <LuChevronDown />}
            </Box>
          )}
          {sign && (
            // It stays visible: this is what says at a glance, without hovering anything,
            // that the reading is over its limit, or that the average has minutes missing
            // from it.
            // Brighter than `fg.warning`, which is a text colour: this is a solid shape a
            // tenth of an inch wide on the section's black ground, and at that size it has
            // to be the loudest thing in the badge or it isn't a warning at all.
            // Nudged a pixel down rather than aligned: the row centres the two boxes, but
            // the digits sit high in theirs (they have no descenders and the line box
            // allows for some), so centred reads as the sign riding above the number.
            // Relative, so it moves the glyph without touching what the row measures.
            <Box
              color={sign}
              fontSize="0.875em"
              lineHeight="1"
              flexShrink="0"
              position="relative"
              top="1px"
            >
              <HiMiniExclamationTriangle />
            </Box>
          )}
          {/* Where there is no level: the shape of one, in its own colour and half faded, so
              the badge reads as a reading that hasn't arrived rather than as an empty box.
              Dashes in the digits' own places rather than the single em-dash formatDb prints
              — that one is for a number in a sentence, and here what is wanted is the
              instrument's blank, the same width and shape as the value it is waiting for. */}
          <Text
            fontSize="1.125em"
            // Every one of them the same weight: the badge's colour and its name are what tell
            // the readings apart, and a lighter number among heavier ones read as a lesser
            // reading rather than as a different quantity.
            fontWeight="600"
            lineHeight="1.2"
            color={shade}
            opacity={db == null ? 0.5 : undefined}
            // A halo of the well's own ground round the digits while it is lit, so the glow
            // falling in from the edges stops short of them rather than washing over their
            // strokes. Invisible anywhere else — it is the colour already behind them.
            textShadow={
              glow
                ? '0 0 0.1em var(--chakra-colors-bg), 0 0 0.4em var(--chakra-colors-bg)'
                : undefined
            }
            textDecoration={ignored ? 'line-through' : undefined}
            ms="auto"
          >
            {db == null ? '--.-' : formatDb(db)}
          </Text>
        </HStack>
      </Box>
      {/* On the colour, in the ground's own shade — the name is the swatch's label, and the
          number above it is what is being read. Small, because it is the same word on every
          card and what changes between them is the number. The unit is not among the words:
          a figure under LAeq,5m is dB by definition, and printing it would be the third way
          this badge says the same thing. */}
      <Text
        // The smallest step the scale names (`2xs`, 10px on a card): the name is read once to
        // learn what the badge is and then only glanced at, and the number is what the tile
        // is for — so this is small, but not so small that `LIMIT 60` is squinted at.
        fontSize="0.625em"
        fontWeight="bold"
        lineHeight="1.4"
        color="bg"
        // The number's side padding, restated against this row's own smaller type.
        px="0.6em"
        // No padding under it: the badge's own frame sits below this row in the same
        // colour, so anything here reads as that much more space than it is — and the row is
        // meant to be the colour running to the bottom edge, not a label floating above it.
        whiteSpace="nowrap"
      >
        {over ? <OverLimitLabel label={label} limitDb={limitDb} /> : label}
      </Text>
    </Box>
  );

  if (!tooltip) return badge;
  return (
    <Tooltip content={tooltip} showArrow>
      {badge}
    </Tooltip>
  );
}

// An `animation` on the limit's beat for the named keyframes, or none for null — phased off
// the wall clock when the keyframes it is given change and held there while they don't, so a
// re-render (and this one re-renders every second) never knocks it out of step.
function useLimitBeat(
  keyframes: string | null,
  timing?: string,
): string | undefined {
  return useMemo(
    () => (keyframes ? limitBeatAnimation(keyframes, timing) : undefined),
    [keyframes, timing],
  );
}

// The name row of a badge over its limit, saying `LIMIT 60` for half of every beat — so a
// breach is spelled out on the badge, figure and all, and not only coloured, for anyone not
// reading red as red or not hovering for the tooltip.
//
// On the limit's beat, with the glow and the chevron (see LIMIT_BEAT_MS): the limit is
// what it says while they are at their height. In CSS rather than off a JS clock for the
// same reason — an interval fires whenever it was started, not on the beat, and a swap that
// lagged the glow by a few hundred milliseconds would be the one thing out of step.
//
// Both are laid in the same cell and the hidden one keeps its room, so the badge is always
// as wide as the longer of the two and never twitches as they trade places.
//
// Steady on the name for anyone who asked for less motion: a line that flashes on and off
// for as long as a reading stays over is the kind of motion that asks to be stopped, and the
// limit is still in the tooltip.
function OverLimitLabel({
  label,
  limitDb,
}: {
  label: string;
  limitDb?: number | null;
}) {
  const name = useLimitBeat('limitLabelName', 'step-end');
  const limit = useLimitBeat('limitLabelLimit', 'step-end');
  return (
    <Box as="span" display="inline-grid" justifyItems="end">
      <Box
        as="span"
        gridArea="1 / 1"
        animation={name}
        _motionReduce={{animation: 'none'}}
      >
        {label}
      </Box>
      <Box
        as="span"
        gridArea="1 / 1"
        opacity="0"
        animation={limit}
        _motionReduce={{animation: 'none'}}
        aria-hidden
      >
        {/* Whole limits as whole numbers — a permit says 60, not 60.0 — and anything finer
            to the reading's one decimal. */}
        {limitDb == null
          ? 'LIMIT'
          : `LIMIT ${Number.isInteger(limitDb) ? limitDb : formatDb(limitDb)}`}
      </Box>
    </Box>
  );
}
