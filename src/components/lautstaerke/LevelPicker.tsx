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
  RANGE_OPTION_LABEL,
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
 * `rangeLeq` is picked in the same menu and kept apart from the set, because it is not one of
 * these windows: the Leq over the whole timeframe has no line, no live value and no playhead,
 * and everything a LevelMetric flows into — the series table, the traces, the chart's columns
 * — would have no answer for it (see LEVEL_METRICS). Only the cards read it.
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
  rangeLeq: boolean;
  toggleRangeLeq: () => void;
} {
  const [weighting, setWeightingState] = useState<Weighting>('A');
  const [metrics, setMetrics] = useState<PickedMetrics>(['eq_fast']);
  // On to begin with: it is the one number a card is compared with its neighbours on, and it
  // was on every card unconditionally before it was pickable at all.
  const [rangeLeq, setRangeLeq] = useState(true);
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
  const toggleRangeLeq = useCallback(() => setRangeLeq((on) => !on), []);
  return {
    weighting,
    setWeighting,
    metrics,
    metric: primaryMetric(metrics),
    toggleMetric,
    rangeLeq,
    toggleRangeLeq,
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
  rangeLeq,
  rangeLeqShown,
  onWeighting,
  onToggleMetric,
  onToggleRangeLeq,
}: {
  // To label, and to disable the one row a live page has no answer for: the finest window is
  // 1 s live and 1 min stored, and the Leq over the timeframe needs a timeframe. Every window
  // means the same thing in either mode; the weighting is what makes one unavailable.
  live: boolean;
  weighting: Weighting;
  metrics: PickedMetrics;
  // What this menu's own row is ticked to. Optional, together with its toggle: it is a
  // reading a *location card* carries, so the row is offered on the page that has cards and
  // left out where the menu picks chart lines only (see the device page). The pick survives
  // a trip through live mode, which is why this is the raw one — the box stays ticked while
  // the row it governs has nothing to say.
  rangeLeq?: boolean;
  // And whether the cards are actually printing it, which is not the same question: live
  // there is no timeframe to average over. Handed down rather than derived from `rangeLeq`
  // and `live` here, which is what this used to do — the count would then be this component
  // reconstructing a decision made elsewhere, and the two would agree only for as long as
  // nobody changed the rule at the other end. The layout owns it (see showRangeLeq) and the
  // same boolean decides whether a card is given the number at all.
  rangeLeqShown?: boolean;
  onWeighting: (weighting: Weighting) => void;
  onToggleMetric: (metric: LevelMetric) => void;
  onToggleRangeLeq?: () => void;
}) {
  const options = metricOptions(live, weighting);
  const primary = options.find((o) => o.value === primaryMetric(metrics));
  // What the button has to account for: the windows, and the timeframe's Leq when a card is
  // printing one — which is what `rangeLeqShown` is, so the count agrees with the page by
  // being told rather than by working it out again.
  const shown = [
    ...metrics.map((m) => options.find((o) => o.value === m)?.label ?? m),
    ...(rangeLeqShown ? [RANGE_OPTION_LABEL] : []),
  ];

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
            aria-label={`Angezeigte Werte: ${shown.join(', ')}`}
          >
            <Span>{primary?.label}</Span>
            {shown.length > 1 && (
              <Span color="fg.muted">+{shown.length - 1}</Span>
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
          {onToggleRangeLeq && (
            // Last, and after the five windows, because it is not one of them: no line is
            // drawn for it and no cursor reads it — it is the average over whatever the
            // timeline is cropped to, printed on the cards (see LocationReadings). In the
            // same menu all the same, because "which levels am I looking at" is one question
            // and answering it in two controls would be the second place to look.
            //
            // Greyed while live, where there is no timeframe to average and the row would
            // promise a number the page cannot produce.
            <MenuCheckboxItem
              value="range"
              checked={Boolean(rangeLeq)}
              disabled={live}
              onCheckedChange={onToggleRangeLeq}
            >
              {RANGE_OPTION_LABEL}
            </MenuCheckboxItem>
          )}
        </MenuContent>
      </MenuRoot>
    </HStack>
  );
}
