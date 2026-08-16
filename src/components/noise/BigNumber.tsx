import {SimpleGrid, Stack, Text, chakra} from '@chakra-ui/react';
import {formatDb} from './level';
import {WEIGHTINGS} from './noise';
import {seriesKey, type ChartSeries, type SeriesKey} from './series';

const tileBase = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1',
  appearance: 'none',
  bg: 'transparent',
  userSelect: 'none',
  borderRadius: 'md',
  transition: 'opacity 0.15s',
} as const;

// A real <button> (keyboard focusable + Enter/Space activatable) with the
// native chrome stripped, laid out as a centered column. Built from Chakra's
// factory so it picks up the design system's tokens and focus ring — including
// the ring itself, which the theme colours for the whole section (see
// theme-crew's `gray.focusRing`) rather than each control naming a hue.
const PickButton = chakra('button', {
  base: {
    ...tileBase,
    cursor: 'pointer',
    focusRing: 'outside',
  },
});

// One reading, and the chart line it stands for: the value (live, or at the cursor while
// hovering) over the window's name, dimmed while the chart is not plotting it. Pressing it
// is how that window is added or dropped, so it is a button — and `aria-pressed` is what
// says which ones are drawn to a reader that cannot see the dimming.
function BigNumber({
  value,
  label,
  color,
  enabled,
  onClick,
}: {
  value: number | null;
  label: string;
  color: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <PickButton
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      flex="1"
      minW="0"
      opacity={enabled ? 1 : 0.2}
      _hover={{opacity: enabled ? 0.8 : 0.4}}
    >
      <Text
        fontSize={{
          base: 'clamp(1rem, 7vw, 2rem)',
          lg: 'clamp(2rem, 6vw, 4rem)',
        }}
        fontWeight="bold"
        lineHeight="1"
      >
        {formatDb(value)}
      </Text>
      <Text fontSize="sm" color={color} fontWeight="bold">
        {label}
      </Text>
    </PickButton>
  );
}

// The big-number rows above the chart, which double as its legend: what every series is
// reading right now, with the drawn ones lit and pressing one being how that is chosen
// (see LiveView).
//
// All nine, since the weighting stopped being a mode of the page: what used to be one row
// of five under a dB(A)/dB(C) switch is now a row per weighting, stacked. Nine tiles across
// one grid would be too narrow to read a number off, and the split is the same one the
// toolbar's menu makes — so a tile and the row it is in stand exactly where the menu's row
// and its heading do.
//
// The two rows are what the weighting is said by. A kind's two weightings share a colour by
// design, so LAFmax and LCFmax are the same red one above the other: the label under each
// names it in full, and the row it is in is the block it belongs to.
//
// The numbers do not follow the chart's cursor, though they once did: the trace under this
// reports a hovered sample itself now (see LevelTrace's tooltip), so these are the latest
// reading and nothing else — every series', whatever is lit.
export function BigNumberRow({
  series,
  picked,
  onPick,
  value,
}: {
  series: ReadonlyArray<ChartSeries>;
  // The series the chart is plotting, which are the tiles that stay lit.
  picked: readonly SeriesKey[];
  // Adds or drops one. The last lit tile cannot be turned off — which the caller enforces,
  // as clicking a checked radio does nothing rather than being refused here.
  onPick: (key: SeriesKey) => void;
  // What to print for a series — null where the device has not reported it yet, which
  // the 5m and 30m windows do until their buffers fill.
  value: (s: ChartSeries) => number | null;
}) {
  // One row per weighting, each in the table's order — which within a weighting is
  // finest-first, the same order the menu lists them in and the chart lays its columns
  // out in.
  const rows = WEIGHTINGS.map((weighting) => ({
    weighting,
    items: series.filter((s) => s.weighting === weighting),
  }));
  // Both rows on the wider one's grid — five, dB(A) having no peak — so a kind sits in the
  // same column in both and the two readings of one quantity are read down the page rather
  // than hunted for. The A row simply ends one tile short, which is what "there is no
  // LApeak" looks like.
  const columns = Math.max(...rows.map((r) => r.items.length));

  return (
    <Stack gap="3" mb="3">
      {rows.map(({weighting, items}) => (
        <SimpleGrid key={weighting} columns={columns} gap="3">
          {items.map((s) => {
            const key = seriesKey(s.kind, s.weighting);
            return (
              <BigNumber
                key={key}
                value={value(s)}
                label={s.label}
                color={s.color}
                enabled={picked.includes(key)}
                onClick={() => onPick(key)}
              />
            );
          })}
        </SimpleGrid>
      ))}
    </Stack>
  );
}
