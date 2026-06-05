import {useState} from 'react';
import {SimpleGrid, Text, chakra} from '@chakra-ui/react';
import type uPlot from 'uplot';
import {seriesKind} from './chartUtils';
import {type Weighting} from './context';

// A real <button> (keyboard focusable + Enter/Space activatable) with the
// native chrome stripped, laid out as a centered column. Built from Chakra's
// factory so it picks up the design system's tokens and focus ring.
const ToggleButton = chakra('button', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1',
    appearance: 'none',
    bg: 'transparent',
    cursor: 'pointer',
    userSelect: 'none',
    borderRadius: 'md',
    transition: 'opacity 0.15s',
    _focusVisible: {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: 'blue.400',
      outlineOffset: '2px',
    },
  },
});

// Doubles as the chart legend: shows the value (live, or at the cursor while
// hovering) and toggles the matching chart line on click. Dimmed when hidden;
// `aria-pressed` exposes the on/off state to assistive tech.
export function BigNumber({
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
    <ToggleButton
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      flex="1"
      minW="0"
      opacity={enabled ? 1 : 0.2}
      _hover={{opacity: enabled ? 0.8 : 0.4}}
    >
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
}: {
  series: ReadonlyArray<S>;
  weighting: Weighting;
  shown: Record<string, boolean>;
  toggle: (kind: string) => void;
  cursorIdx: number | 'gap' | null;
  data: uPlot.AlignedData;
  liveValue?: (s: S) => number | null;
}) {
  const items = series
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
      return {kind, label: s.label, color: s.stroke, value, enabled: shown[kind]};
    });

  return (
    <SimpleGrid columns={items.length || 1} gap="3" mb="3">
      {items.map((n) => (
        <BigNumber
          key={n.label}
          value={n.value}
          label={n.label}
          color={n.color}
          enabled={n.enabled}
          onClick={() => toggle(n.kind)}
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
