import {useCallback, useState} from 'react';
import {Box, Button, HStack, Span} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../chakra-snippets/native-select';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {type Weighting} from './noise';
import {
  WEIGHTING_OPTIONS,
  metricOptions,
  primaryMetric,
  supportedMetrics,
  toggledMetrics,
  type LevelMetric,
  type PickedMetrics,
} from './level';

/**
 * What the picker picks, as state a page can own: which frequency weighting everything on
 * it is read in, and which windows its charts draw.
 *
 * Here rather than twice in two routes because the two choices are not independent —
 * LCpeak has no A-weighted counterpart, so changing the weighting may have to drop a
 * window from the set (see supportedMetrics). That rule is what a page must not get wrong,
 * and a page that kept the pair in two plain useStates would be the second place it is
 * written down.
 *
 * `metric` is the set's primary and the one every *number* on the page is read in — the
 * charts draw all of them, the readouts read one. Derived here (see primaryMetric) so
 * there is no second piece of state to keep inside the set.
 *
 * The set's identity is load-bearing: it goes into the project page's context and into the
 * memos that build the traces, so an unchanged pick has to come back as the *same* array.
 * Both helpers below promise that, which is why nothing here filters or sorts in place.
 */
export function useLevelPick(): {
  weighting: Weighting;
  setWeighting: (weighting: Weighting) => void;
  metrics: PickedMetrics;
  metric: LevelMetric;
  toggleMetric: (metric: LevelMetric) => void;
} {
  const [weighting, setWeightingState] = useState<Weighting>('A');
  const [metrics, setMetrics] = useState<PickedMetrics>(['eq_fast']);
  // Both updates in one batch, which is the invariant every chart downstream relies on:
  // no render may see dB(A) with LCpeak still picked, because seriesFor has no row for
  // that pair and the column it would fall back to holds timestamps.
  const setWeighting = useCallback((next: Weighting) => {
    setWeightingState(next);
    setMetrics((prev) => supportedMetrics(prev, next));
  }, []);
  const toggleMetric = useCallback(
    (metric: LevelMetric) => setMetrics((prev) => toggledMetrics(prev, metric)),
    [],
  );
  return {
    weighting,
    setWeighting,
    metrics,
    metric: primaryMetric(metrics),
    toggleMetric,
  };
}

// The project header's two controls: what every pin and every row on the page is showing.
// Two of them rather than one combined list, because the choices are independent — a single
// list would be eight labels to read through to change the weighting.
//
// The weighting is a native select, being one of two things. The windows are a set, which a
// native select cannot express: `multiple` is a scrolling listbox that wants a ctrl-click,
// and neither the box nor the modifier belongs in a strip on a phone. So they are a
// checkbox menu behind a button that collapses to the first pick and a count — the header
// already carries the live switch and the view switcher, and five options' worth of
// segments or chips would not fit beside them.
//
// The first pick is what the button names on purpose: it is the metric every number on the
// page is read in (see primaryMetric), so the control that sets it is also where that is
// stated.
export function LevelPicker({
  live,
  weighting,
  metrics,
  onWeighting,
  onToggleMetric,
}: {
  // Only to label: the finest window is 1 s live and 1 min stored. Every option means
  // the same thing in either mode — the one thing that had no live counterpart, the
  // Leq over the timeframe, is now shown on the rows themselves rather than picked
  // here — so the mode never disables anything. The weighting does.
  live: boolean;
  weighting: Weighting;
  metrics: PickedMetrics;
  onWeighting: (weighting: Weighting) => void;
  onToggleMetric: (metric: LevelMetric) => void;
}) {
  const options = metricOptions(live, weighting);
  const primary = options.find((o) => o.value === primaryMetric(metrics));

  return (
    <HStack gap="2">
      <NativeSelectRoot size="xs" w="auto">
        <NativeSelectField
          aria-label="Frequenzbewertung"
          value={weighting}
          onChange={(e) => onWeighting(e.target.value as Weighting)}
          items={WEIGHTING_OPTIONS}
        />
      </NativeSelectRoot>
      {/* Stays open while boxes are ticked: picking a set is several presses, and a menu
          that closed after each would have to be reopened to compare two windows — which
          is the very thing several lines are for. */}
      <MenuRoot closeOnSelect={false} positioning={{placement: 'bottom-end'}}>
        <MenuTrigger asChild>
          {/* Outlined at the same size as the select beside it, so the two read as one
              pair of controls rather than a dropdown and a button. */}
          <Button
            variant="outline"
            size="xs"
            px="2"
            gap="1"
            fontWeight="normal"
            // Names the control *and* what it is set to: the visible "+2" says how many
            // more without saying which, and a button whose accessible name was the label
            // alone would leave a reader knowing only the first.
            aria-label={`Angezeigte Werte: ${metrics
              .map((m) => options.find((o) => o.value === m)?.label ?? m)
              .join(', ')}`}
          >
            <Span>{primary?.label}</Span>
            {metrics.length > 1 && (
              <Span color="fg.muted">+{metrics.length - 1}</Span>
            )}
            <Box asChild flexShrink="0" color="fg.muted">
              <LuChevronDown />
            </Box>
          </Button>
        </MenuTrigger>
        <MenuContent>
          {options.map(({value, label, disabled}) => {
            const checked = metrics.includes(value);
            return (
              // Disabled only where the weighting has no such series — a peak is
              // C-weighted by definition. The last lit line stays pressable even though
              // unticking it is refused (see toggledMetrics): a whole menu of live options
              // with one greyed row reads as if that row were unavailable, when what is
              // true is the opposite — it is the only one being shown. Pressing it simply
              // leaves it ticked, which is also what a set of one means.
              <MenuCheckboxItem
                key={value}
                value={value}
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => onToggleMetric(value)}
              >
                {label}
              </MenuCheckboxItem>
            );
          })}
        </MenuContent>
      </MenuRoot>
    </HStack>
  );
}
