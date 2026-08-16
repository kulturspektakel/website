import {memo, useCallback, useState} from 'react';
import {Box, Button, Span} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuItemGroup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {type SeriesKey} from './series';
import {
  primaryWeighting,
  rangeLabel,
  seriesLabel,
  seriesOptions,
  toggledSeries,
  type PickedSeries,
} from './level';

// The menu's rows, both modes' worth, built once. `seriesOptions` is a pure function of the
// one boolean, and this menu is a child of a header that re-renders every animation frame
// while the playhead moves — so the nine labels were being recomposed sixty times a second
// to come out the same.
const GROUPS = {live: seriesOptions(true), stored: seriesOptions(false)};

/**
 * What the picker picks, as state a page can own: which series its charts draw.
 *
 * One set and not a weighting beside a set of windows, which is what this used to be. The
 * two were never independent — LCpeak has no A-weighted counterpart, so changing the
 * weighting could drop a window — and worse, they could not say the thing anyone actually
 * wants to compare, an A-weighted level against a C-weighted one. A series carries its own
 * weighting, so picking is picking lines and the coupling has nothing left to get wrong.
 *
 * The set's first in table order is the one every *single* number is read in — the charts
 * draw all of them, a map pin has room for one, and the crop's Leq is one energetic mean and
 * so has one weighting. Not returned beside the set, though it once was: it is `picked[0]`
 * (see primarySeries), so a second field here was a derived value plumbed through the
 * context and a prop to save its two readers one call.
 *
 * `rangeLeq` is picked in the same menu and kept apart from the set, because it is not one of
 * these series: the Leq over the whole timeframe has no line, no live value and no playhead,
 * and everything a series flows into — the table, the traces, the chart's columns — would
 * have no answer for it. Only the cards read it.
 *
 * The set's identity is load-bearing: it goes into the project page's context and into the
 * memos that build the traces, so an unchanged pick has to come back as the *same* array.
 * toggledSeries promises that, which is why nothing here filters or sorts in place.
 */
export function useLevelPick(): {
  picked: PickedSeries;
  toggleSeries: (key: SeriesKey) => void;
  rangeLeq: boolean;
  toggleRangeLeq: () => void;
} {
  // The everyday one, and the same default the page opened on when the weighting was its
  // own control set to dB(A).
  const [picked, setPicked] = useState<PickedSeries>(['eq_fast:A']);
  // On to begin with: it is the one number a card is compared with its neighbours on, and it
  // was on every card unconditionally before it was pickable at all.
  const [rangeLeq, setRangeLeq] = useState(true);
  const toggleSeries = useCallback(
    (key: SeriesKey) => setPicked((prev) => toggledSeries(prev, key)),
    [],
  );
  const toggleRangeLeq = useCallback(() => setRangeLeq((on) => !on), []);
  return {picked, toggleSeries, rangeLeq, toggleRangeLeq};
}

// The project header's one control: what every pin and every row on the page is showing.
//
// One rather than the weighting select and the window menu it used to be. Those read as two
// independent choices and were not — and between them they could not express the comparison
// the pick is a set for in the first place, an A-weighted level against a C-weighted one.
// Here the weighting is a property of the line, so there are simply nine lines to tick, in
// two blocks headed by the unit they are read in: eight labels to scan past is what a flat
// list of nine would be, and the headings are what turn it back into five quantities twice
// over.
//
// A checkbox menu, which is what a set needs and a native select cannot express: `multiple`
// is a scrolling listbox that wants a ctrl-click, and neither the box nor the modifier
// belongs in a strip on a phone. Behind a button that collapses to the first pick and a
// count — the header already carries the live switch and the view switcher, and nine
// options' worth of segments or chips would not fit beside them.
//
// The first pick is what the button names on purpose: it is the series every single number
// on the page is read in (see primarySeries), so the control that sets it is also where that
// is stated.
//
// Memoized, because it is a child of a header that re-renders on every frame of a playhead
// hover and none of its props move while that happens: `picked` is identity-stable by
// toggledSeries' contract and both callbacks come out of useLevelPick's useCallback. Nine
// checkbox rows in a portal that is mounted whether or not the menu is open is not a
// subtree worth rebuilding sixty times a second for no change.
export const LevelPicker = memo(function LevelPicker({
  live,
  picked,
  rangeLeq,
  rangeLeqShown,
  onToggleSeries,
  onToggleRangeLeq,
}: {
  // To label, and to disable the one row a live page has no answer for: the finest window is
  // 1 s live and 1 min stored, and the Leq over the timeframe needs a timeframe. Every series
  // means the same thing in either mode.
  live: boolean;
  picked: PickedSeries;
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
  onToggleSeries: (key: SeriesKey) => void;
  onToggleRangeLeq?: () => void;
}) {
  const groups = live ? GROUPS.live : GROUPS.stored;
  // The crop's Leq is an energetic mean over one weighting's minute column, and the one it
  // comes out in is the primary's — so its row is named for that, and renames itself as the
  // pick above it changes. The same name the card prints under the number, off the same
  // derivation (see primaryWeighting and rangeLabel), because it is the same reading.
  const range = rangeLabel(primaryWeighting(picked));
  // What the button has to account for: the picked series, and the timeframe's Leq when a
  // card is printing one — which is what `rangeLeqShown` is, so the count agrees with the
  // page by being told rather than by working it out again.
  const shown = [
    ...picked.map((key) => seriesLabel(key, live)),
    ...(rangeLeqShown ? [range] : []),
  ];

  return (
    // No wrapper: there is one control here now, and a row of one was a box the toolbar
    // had to lay out around a single button.
    //
    // Stays open while boxes are ticked: picking a set is several presses, and a menu that
    // closed after each would have to be reopened to compare two series — which is the very
    // thing several lines are for.
    <MenuRoot closeOnSelect={false} positioning={{placement: 'bottom-end'}}>
      <MenuTrigger asChild>
        {/* Outlined at the size of the controls it sits among — the live switch, the
              view select — so the strip reads as one row rather than a button dropped
              into it. */}
        <Button
          variant="outline"
          size="xs"
          px="2"
          gap="1"
          fontWeight="normal"
          // Names the control *and* what it is set to: the visible "+2" says how many
          // more without saying which, and a button whose accessible name was the label
          // alone would leave a reader knowing only the first.
          aria-label={`Values shown: ${shown.join(', ')}`}
        >
          <Span>{shown[0]}</Span>
          {shown.length > 1 && (
            <Span color="fg.muted">+{shown.length - 1}</Span>
          )}
          <Box asChild flexShrink="0" color="fg.muted">
            <LuChevronDown />
          </Box>
        </Button>
      </MenuTrigger>
      <MenuContent>
        {/* A block per weighting, headed by the unit its rows are read in — which is what
              makes nine rows scannable: the letter that distinguishes LAeq,5m from LCeq,5m
              is the heading you are under rather than something to spot mid-word. It is
              also the only thing that distinguishes them on the chart, the two weightings
              of a quantity sharing a colour by design (see the series table). */}
        {groups.map(({weighting, unit, options}) => (
          <MenuItemGroup key={weighting} title={unit}>
            {options.map(({key, label}) => (
              // The last lit line stays pressable even though unticking it is refused
              // (see toggledSeries): a whole menu of live options with one greyed row
              // reads as if that row were unavailable, when what is true is the opposite
              // — it is the only one being shown. Pressing it simply leaves it ticked,
              // which is also what a set of one means.
              <MenuCheckboxItem
                key={key}
                value={key}
                checked={picked.includes(key)}
                onCheckedChange={() => onToggleSeries(key)}
              >
                {label}
              </MenuCheckboxItem>
            ))}
          </MenuItemGroup>
        ))}
        {onToggleRangeLeq && (
          <>
            {/* Under a rule and outside both blocks, because it belongs to neither: it is
                  weighted, and named for it, but not by a choice of its own — the mean comes
                  out in whichever weighting the primary pick is in, so filing it under one
                  block would offer a choice that ticking it does not make. */}
            <MenuSeparator />
            {/* Last, and after the nine series, because it is not one of them: no line is
                  drawn for it and no cursor reads it — it is the average over whatever the
                  timeline is cropped to, printed on the cards (see LocationReadings). In the
                  same menu all the same, because "which levels am I looking at" is one
                  question and answering it in two controls would be the second place to
                  look.

                  Greyed while live, where there is no timeframe to average and the row would
                  promise a number the page cannot produce. */}
            <MenuCheckboxItem
              value="range"
              checked={Boolean(rangeLeq)}
              disabled={live}
              onCheckedChange={onToggleRangeLeq}
            >
              {range}
            </MenuCheckboxItem>
          </>
        )}
      </MenuContent>
    </MenuRoot>
  );
});
