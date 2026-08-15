import {SimpleGrid, Text, chakra} from '@chakra-ui/react';
import {formatDb} from './level';
import {type Weighting} from './noise';
import {type ChartSeries, type SeriesKind} from './series';

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

// The big-number row above the chart, which doubles as its legend: what every window of
// the current weighting is reading right now, with the drawn ones lit and pressing one
// being how that is chosen (see LiveView).
//
// A set again, as it was when the chart plotted nine lines at once — but bounded to the
// five windows of a weighting, each with a colour of its own, so which line is which is
// answered by the colour rather than by hovering. The tiles are the legend that makes that
// work, and they are the other entrance to the same choice the toolbar's menu sets.
//
// The numbers do not follow the chart's cursor, though they once did: the trace under this
// reports a hovered sample itself now (see LevelTrace's tooltip), so these are the latest
// reading and nothing else — every window's, whatever is lit.
export function BigNumberRow({
  series,
  weighting,
  picked,
  onPick,
  value,
}: {
  series: ReadonlyArray<ChartSeries>;
  weighting: Weighting;
  // The windows the chart is plotting, which are the tiles that stay lit.
  picked: readonly SeriesKind[];
  // Adds or drops one. The last lit tile cannot be turned off — which the caller enforces,
  // as clicking a checked radio does nothing rather than being refused here.
  onPick: (kind: SeriesKind) => void;
  // What to print for a series — null where the device has not reported it yet, which
  // the 5m and 30m windows do until their buffers fill.
  value: (s: ChartSeries) => number | null;
}) {
  const items = series.filter((s) => s.weighting === weighting);

  return (
    <SimpleGrid columns={items.length || 1} gap="3" mb="3">
      {items.map((s) => (
        <BigNumber
          key={s.label}
          value={value(s)}
          label={s.label}
          color={s.color}
          enabled={picked.includes(s.kind)}
          onClick={() => onPick(s.kind)}
        />
      ))}
    </SimpleGrid>
  );
}
