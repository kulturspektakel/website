import {Box, HStack, Text} from '@chakra-ui/react';
// The one icon in this section that isn't lucide's, for two reasons: lucide is a stroke-only
// set, and at the size this sits — 12px, inside a badge — an outlined triangle is a few
// hairlines that read as a smudge. Heroicons' *mini* set is drawn for exactly this size, on a
// 20px grid with the corners rounded and the "!" knocked out by fill-rule rather than by
// winding — so it stays a warning sign rather than becoming a solid lozenge.
import {HiMiniExclamationTriangle} from 'react-icons/hi2';
import {Tooltip} from '../chakra-snippets/tooltip';
import {useDeviceStates, useTick} from './context';
import {
  displayedLevel,
  formatDb,
  loudestLevel,
  primaryWeighting,
  rangeLabel,
  seriesLabel,
  type DisplayedLevel,
  type PickedSeries,
} from './level';
import {seriesByKey, SERIES} from './series';
import {type ChartSeriesToken} from '../../theme-noise';
import {coverageDetail} from './leq';
import {type PlayheadLevels, type RangeTotals} from './projectLogs';
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
//   the crop    — the energetic mean of that loudest, minute by minute, summed upstream
//                 (see locationEnergyIndex), in the primary's weighting — one mean has room
//                 for one. It is the average of the very area the chart below fills while
//                 the primary is what that area is drawn from, so the number and the picture
//                 agree in the ordinary case.
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
// it is drawn in — its line's, or a neutral for the crop's mean, which has no line.
type PrintedLevel = {
  key: string;
  level: DisplayedLevel;
  label: string;
  color: ChartSeriesToken | 'fg';
  // What qualifies the number, for the one tile that has anything to qualify it — the
  // coverage behind the crop's mean. Carried by the tile rather than as a flag saying
  // "I am the last one", which is a claim about position that reordering the row would
  // silently make false.
  caveat?: string;
};

// The badge's corner, and the corner of the box inside it. Concentric, which means the
// inner one is the outer less the 1px of frame between them — curve both by the same
// radius and the frame reads as thickening at the corners.
const BADGE_RADIUS = 'md';
const INNER_RADIUS = `calc(var(--chakra-radii-${BADGE_RADIUS}) - 1px)`;

// The most badges a row may put on one line, per breakpoint — the cap that makes five of
// them fall onto a second row on a narrow card (see the grid below for why a cap rather
// than wrapping).
const GRID_CAPS = {base: 2, sm: 3, lg: Infinity} as const;

// The grid a row of `n` badges is laid out in, for every count this can print: the picked
// series, at most the whole table's worth, and the crop's mean after them.
//
// A table rather than three template literals built where the Box is: this component
// re-renders at least once a second from its own tick, and again on every animation frame
// of a crop drag through the context, per card on the page — and the answer is a pure
// function of a number between one and six. Hoisted for the same reason MARKERS_CSS and
// CHART_CSS are, one file over: Emotion resolves it once for the session rather than
// hashing a fresh object per card per frame.
const GRID_COLUMNS = Array.from(
  {length: SERIES.length + 2},
  (_, n) =>
    ({
      base: `repeat(${Math.min(n, GRID_CAPS.base)}, 1fr)`,
      sm: `repeat(${Math.min(n, GRID_CAPS.sm)}, 1fr)`,
      lg: `repeat(${n}, 1fr)`,
    }) as const,
);

export function LocationReadings({
  assignments,
  total,
  levels,
  live,
  picked,
}: {
  // The monitors standing here at the instant being viewed — which while live means the
  // ones standing here now. Not the location's whole history: that is what the names
  // above and the chart below are drawn from, and averaging a monitor's time at another
  // stage into this place's reading is the mistake this shape exists to prevent.
  assignments: NoiseAssignment[];
  // This location's Leq over the crop, already the envelope — and a badge here for as long as
  // there is one. Absent while live, when an instant has no range to average over it, and
  // absent when the menu's `Leq,Range` is unticked: the caller decides whether it is asked
  // for, and this prints whatever it is given.
  total?: RangeTotals;
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
}) {
  // One wake-up for the header's whole set — a location's two monitors are read
  // together and printed as one reading, so there is nothing to gain from rendering
  // them apart.
  const deviceState = useDeviceStates(assignments.map((a) => a.deviceId));
  // Local tick: freshness is per-card, so this doesn't re-render its siblings.
  const now = useTick();

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
    ...picked.map((series) => ({
      key: series,
      level: loudestLevel(
        assignments.map((a) =>
          displayedLevel({
            live,
            now,
            series,
            state: deviceState(a.deviceId),
            historyDb: levels?.[series]?.[a.deviceId],
          }),
        ),
      ),
      // The quantity spelled out — `LAeq,5m` — off the series table's own naming, and
      // in the mode's own window (a second live, a stored minute; see seriesLabel).
      label: seriesLabel(series, live),
      // Straight from the series table too, the one place a level's colour is decided,
      // so a number and the line it was read off cannot end up different shades.
      color: seriesByKey(series).color,
    })),
    // Last, and hard against the edge of the card: the number every card is compared on
    // lines up in one column down the page, whatever is picked above it. Named for the
    // timeframe where the others name a window, because that is what it averages, and in a
    // grey rather than a line's colour — it is the mean of the whole picture rather than a
    // reading off any one line of it, and the badge has to be *some* colour to be a badge.
    //
    // Absent altogether while live — an instant has no range to average — and absent when
    // the menu's `Leq,Range` is unticked. Off `total` directly rather than through a
    // DisplayedLevel built only to be tested for emptiness: there is nothing here that
    // could be stale or unheard, only a mean or no mean at all.
    //
    // Its caveat is the coverage, because a Leq over a crop is an average of the minutes
    // that were measured and how many there were is part of the reading: without it a place
    // monitored for two minutes of an hour is indistinguishable from one monitored
    // throughout. Measured against the minutes a monitor was assigned *here*, so an empty
    // stretch is the location's gap and not charged to the monitor that covered the rest.
    // Same rule as the device page's Leq tile, thresholds included, so a shortfall too small
    // to matter stays unsaid in both.
    ...(total == null
      ? []
      : [
          {
            key: 'range',
            level: {kind: 'history', db: total.db} as const,
            // In the primary's weighting, that being the one it was summed in — so ticking
            // a C-weighted row to the top of the pick relabels this LCeq,Range and the
            // number under it changes with the name.
            label: rangeLabel(primaryWeighting(picked)),
            // The one reading with no line of its own, so it takes a neutral rather than a
            // place on the series ramp — but at full `fg` rather than muted: it is the
            // number the card is summed up by, and a grey among five saturated badges read
            // as the one that had been switched off.
            color: 'fg' as const,
            caveat: coverageDetail(total),
          },
        ]),
  ];

  return (
    // Side by side rather than stacked: they are several readings of one place at one instant,
    // not a headline and its footnotes. And never squashed: what gives when the header runs out
    // of width is the device names beside it, which truncate.
    //
    // A grid of equal columns rather than a row of badges, which is what makes them all one
    // width without that width being written down anywhere: `1fr` tracks in a box sized by its
    // own contents come out equal, and equal to the widest of them — so the longest name, which
    // is the crop's `LAeq,Range` rather than any number, sets the size of every badge, and
    // renaming it resizes them rather than clipping one.
    //
    // The column count is capped so the badges fall onto a second row where five of them would
    // not fit a narrow card: a grid does not wrap, and this is what a wrapping row's line
    // breaks would have done, decided by the space there is rather than found by the browser.
    // Fewer badges than the cap is simply fewer columns.
    //
    // Only the readings, and nothing about the monitors: when one was last heard from is a
    // fact about *that monitor*, so it is on its own badge (see DeviceBadge). Said here, once,
    // it was the newer monitor's silence reported for both of a card's two — and a clock under
    // a column of levels reads as one of them.
    <Box
      display="grid"
      gridTemplateColumns={GRID_COLUMNS[printed.length]}
      gap="1.5"
      flexShrink="0"
    >
      {printed.map(({key, level, label, color, caveat}) => (
        <ReadingTile
          key={key}
          db={level.kind === 'none' ? null : level.db}
          label={label}
          // Muted when the number is only the last thing we heard, so a reading that
          // has stopped moving doesn't keep reading as one that hasn't — saying "not
          // now" then matters more than which line it belongs to.
          color={level.kind === 'stale' ? 'fg.subtle' : color}
          // The coverage rides with the crop's Leq, inside its tile, so it reads as a
          // caveat on that number rather than as another reading of its own.
          caveat={caveat}
        />
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
}: {
  // The level, or null where this window has nothing at the instant being viewed — an empty
  // badge, keeping its place and its name.
  db: number | null;
  // What the number is — `LAeq,5m`, or the timeframe for the one averaged over all of it.
  label: string;
  // The line's shade. The crop's mean has no line, and takes a neutral (see the caller).
  color: string;
  // The coverage shortfall, spelled out, where there is one worth saying.
  caveat?: string;
}) {
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
      minW="70px"
      // The colour is the badge, and the hairline of it left showing around the number is
      // what makes the two rows one object rather than a number with a bar under it.
      bg={color}
      p="1px"
      textAlign="right"
      // The badge gives back four pixels at the bottom: the header's height is set by the
      // tallest thing in it, and a row of these was making the card taller than the name and
      // the monitors beside them need — the chart underneath is what wants that height.
      mb="-4px"
      {...(caveat && {
        // A hover target the size of the badge, rather than a sign inside it to hit: the
        // caveat is about this reading, so the reading is what carries it. Focusable for the
        // same reason the sign used to be — a warning nobody can read is worse than none —
        // and `help` rather than `pointer`, which would promise it did something.
        as: 'button' as const,
        type: 'button' as const,
        'aria-label': caveat,
        cursor: 'help',
        focusRing: 'outside' as const,
      })}
    >
      {/* Air above and below the number — the badge is read as a number first, and the ground
          it sits on is what gives it room to be one. */}
      <Box bg="bg" px="1.5" py="0.5" roundedTop={INNER_RADIUS}>
        {/* The sign goes to the far left, where it is out of the numbers' way: they line up
            on the right edge of the badge and down the page, and a sign between them and
            that edge would push the one card that has it out of the column. */}
        <HStack gap="1.5" justify="space-between" minW="0">
          {caveat && (
            // It stays visible: this is what says at a glance, without hovering anything,
            // that the average has minutes missing from it.
            // Brighter than `fg.warning`, which is a text colour: this is a solid shape a
            // tenth of an inch wide on the section's black ground, and at that size it has
            // to be the loudest thing in the badge or it isn't a warning at all.
            // Nudged a pixel down rather than aligned: the row centres the two boxes, but
            // the digits sit high in theirs (they have no descenders and the line box
            // allows for some), so centred reads as the sign riding above the number.
            // Relative, so it moves the glyph without touching what the row measures.
            <Box
              color="yellow.300"
              fontSize="sm"
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
            fontSize="lg"
            // Every one of them the same weight: the badge's colour and its name are what tell
            // the readings apart, and a lighter number among heavier ones read as a lesser
            // reading rather than as a different quantity.
            fontWeight="600"
            lineHeight="1.2"
            color={color}
            opacity={db == null ? 0.5 : undefined}
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
        // Below the smallest step the scale names (`2xs`, 10px): the name is read once to
        // learn what the badge is and then only glanced at, and the number is what the tile
        // is for — so this is as small as it can be and still be a word.
        fontSize="0.5625rem"
        fontWeight="bold"
        lineHeight="1.4"
        color="bg"
        px="1.5"
        // No padding under it: the badge's own 1px of frame sits below this row in the same
        // colour, so anything here reads as that much more space than it is — and the row is
        // meant to be the colour running to the bottom edge, not a label floating above it.
        whiteSpace="nowrap"
      >
        {label}
      </Text>
    </Box>
  );

  if (!caveat) return badge;
  return (
    <Tooltip content={caveat} showArrow>
      {badge}
    </Tooltip>
  );
}
