import {useState} from 'react';
import {SimpleGrid, Text, chakra} from '@chakra-ui/react';
import type uPlot from 'uplot';
import {seriesKind} from './chartUtils';
import {type Weighting} from './context';

// Shared by both tile variants so they can't drift apart visually.
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
// factory so it picks up the design system's tokens and focus ring.
const ToggleButton = chakra('button', {
  base: {
    ...tileBase,
    cursor: 'pointer',
    _focusVisible: {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: 'blue.400',
      outlineOffset: '2px',
    },
  },
});

// Same tile, but for a value with no chart line behind it — a dead button would
// be a keyboard trap and read as pressable to assistive tech, so it isn't one.
const StaticTile = chakra('div', {base: tileBase});

// Usually doubles as the chart legend: shows the value (live, or at the cursor
// while hovering) and toggles the matching chart line on click. Dimmed when
// hidden; `aria-pressed` exposes the on/off state to assistive tech. Omit
// `onClick` for a value that has no line to toggle (the timeframe Leq) — it then
// renders as a plain, always-full-opacity tile.
export function BigNumber({
  value,
  label,
  color,
  enabled = true,
  onClick,
  sub,
}: {
  value: number | null;
  label: string;
  color: string;
  enabled?: boolean;
  onClick?: () => void;
  // Small note under the label, e.g. how much of the window had data.
  sub?: string;
}) {
  const body = (
    <>
      <Text
        fontSize={{base: 'clamp(1rem, 7vw, 2rem)', lg: 'clamp(2rem, 6vw, 4rem)'}}
        fontFamily="mono"
        fontWeight="bold"
        lineHeight="1"
      >
        {value == null ? '—' : value.toFixed(1)}
      </Text>
      <Text fontSize="sm" color={color} fontWeight="bold">
        {label}
      </Text>
      {sub && (
        <Text fontSize="xs" color="gray.500" lineHeight="1">
          {sub}
        </Text>
      )}
    </>
  );

  if (!onClick) {
    return (
      <StaticTile flex="1" minW="0">
        {body}
      </StaticTile>
    );
  }
  return (
    <ToggleButton
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      flex="1"
      minW="0"
      opacity={enabled ? 1 : 0.2}
      _hover={{opacity: enabled ? 0.8 : 0.4}}
    >
      {body}
    </ToggleButton>
  );
}

// The big-number row that doubles as the chart legend, shared by the live and
// historical views. For each series of the current weighting it shows the value
// at the hovered sample (column i+1 mirrors series[i]), or — while not hovering
// — the optional `liveValue` (the live latest reading; omitted for historical,
// where the numbers stay blank until hover). Clicking toggles the series.
export function BigNumberRow<
  S extends {label: string; weighting: Weighting; stroke: string},
>({
  series,
  weighting,
  shown,
  toggle,
  cursorIdx,
  data,
  liveValue,
  aggregate,
}: {
  series: ReadonlyArray<S>;
  weighting: Weighting;
  shown: Record<string, boolean>;
  toggle: (kind: string) => void;
  cursorIdx: number | 'gap' | null;
  data: uPlot.AlignedData;
  liveValue?: (s: S) => number | null;
  // A tile with no data column behind it: a value over the whole window, so it
  // ignores the cursor and isn't toggleable. Inserted after the series labelled
  // `after` (falling back to the end) to keep the 1m → 5m → 30m → total reading
  // order. Deliberately not a `series` entry: those are index-coupled to the
  // aligned columns and shared with the chart, which would plot a phantom line.
  aggregate?: {
    after: string;
    label: string;
    color: string;
    value: number | null;
    sub?: string;
  };
}) {
  const items: Array<{
    label: string;
    color: string;
    value: number | null;
    // Absent for the aggregate tile — nothing to toggle.
    kind?: string;
    sub?: string;
  }> = series
    .map((s, i) => ({s, i}))
    .filter(({s}) => s.weighting === weighting)
    .map(({s, i}) => {
      const kind = seriesKind(s.label);
      const value =
        cursorIdx === 'gap'
          ? null
          : cursorIdx != null
            ? ((data[i + 1]?.[cursorIdx] ?? null) as number | null)
            : liveValue
              ? liveValue(s)
              : null;
      return {kind, label: s.label, color: s.stroke, value};
    });

  if (aggregate) {
    const at = items.findIndex((n) => n.label === aggregate.after);
    items.splice(at < 0 ? items.length : at + 1, 0, {
      label: aggregate.label,
      color: aggregate.color,
      value: aggregate.value,
      sub: aggregate.sub,
    });
  }

  return (
    <SimpleGrid columns={items.length || 1} gap="3" mb="3">
      {items.map((n) => (
        <BigNumber
          key={n.label}
          value={n.value}
          label={n.label}
          color={n.color}
          sub={n.sub}
          enabled={n.kind == null || shown[n.kind]}
          onClick={n.kind == null ? undefined : () => toggle(n.kind!)}
        />
      ))}
    </SimpleGrid>
  );
}

// Visibility keyed by weighting-independent series kind, so the toggle state
// mirrors what's plotted and carries across the dB(A)/dB(C) switch.
export function useSeriesToggle(
  series: ReadonlyArray<{label: string; hidden?: boolean}>,
) {
  const [shown, setShown] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const s of series) m[seriesKind(s.label)] = !('hidden' in s && s.hidden);
    return m;
  });
  return {
    shown,
    toggle: (kind: string) =>
      setShown((prev) => ({...prev, [kind]: !prev[kind]})),
  };
}
