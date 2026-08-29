import {memo, useCallback, useEffect, useState} from 'react';
import {Box, Button, Span} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuItemGroup,
  MenuItemGroupLabel,
  MenuRadioItem,
  MenuRadioItemGroup,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {SERIES_KEYS, type SeriesKey} from './series';
import {
  onlySeries,
  primarySeries,
  primaryWeighting,
  rangeLabel,
  seriesLabel,
  seriesOptions,
  toggledSeries,
  type PickedSeries,
} from './level';
import {
  DEFAULT_PICK,
  readStoredPick,
  writeStoredPick,
  type SeriesStore,
} from './seriesSelection';

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
export function useLevelPick({
  // Which page's remembered pick this is. Per page and not per section, because the three
  // pages that pick series want different sets of them — see seriesSelection.ts.
  store,
  // Whether the page has room for more than one. The map has not: a pin is a badge with one
  // number on it, so ticking there replaces rather than adds (see onlySeries), the menu's
  // rows are radios, and what is stored is one key.
  single = false,
}: {
  store: SeriesStore;
  single?: boolean;
}): {
  picked: PickedSeries;
  toggleSeries: (key: SeriesKey) => void;
  rangeLeq: boolean;
  toggleRangeLeq: () => void;
} {
  // The everyday series and the crop's Leq on — what the menu was set to before either was
  // remembered, and now only what is on screen until the store has been read, which is the
  // frame after mount (see DEFAULT_PICK).
  const [picked, setPicked] = useState<PickedSeries>(DEFAULT_PICK.picked);
  const [rangeLeq, setRangeLeq] = useState(DEFAULT_PICK.rangeLeq);

  // The stored state of the menu is read after mount rather than in the initializers above,
  // and that is the whole reason this is an effect: these pages are server-rendered, and a
  // lazy initializer reading localStorage would hand hydration different lines than the
  // server drew. Same arrangement as the column count and the location selection, and for
  // the same reason (see listColumns.ts).
  //
  // Keyed on the store, so it re-reads when the page switches views: the project layout owns
  // one pick and hands it to whichever of the two is on screen, and those two remember
  // separately — the list's set of lines and the map's single one. One frame of the previous
  // view's pick in between, which is the frame the route itself is changing on.
  useEffect(() => {
    const stored = readStoredPick(store, single) ?? DEFAULT_PICK;
    setPicked(stored.picked);
    setRangeLeq(stored.rangeLeq);
  }, [store, single]);

  // Both halves of the menu are written on every press, because the entry is the menu rather
  // than one of its rows — so each toggle needs the other half as it stands, which is why
  // they are read off the render rather than out of an updater. That is also what keeps the
  // write to one: React invokes updaters twice in development, and writing to storage is not
  // the kind of thing to do twice.
  //
  // Nothing is written for a press that changed nothing — the last lit line pressed again, or
  // the map's one row pressed twice — since both hand back the very array they were given.
  const toggleSeries = useCallback(
    (key: SeriesKey) => {
      const next = single
        ? onlySeries(picked, key)
        : toggledSeries(picked, key);
      if (next === picked) return;
      setPicked(next);
      writeStoredPick(store, {picked: next, rangeLeq});
    },
    [picked, rangeLeq, single, store],
  );
  const toggleRangeLeq = useCallback(() => {
    setRangeLeq(!rangeLeq);
    writeStoredPick(store, {picked, rangeLeq: !rangeLeq});
  }, [picked, rangeLeq, store]);
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
  single = false,
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
  // Whether only one series may be lit, which is the map's case: a pin has room for one
  // number, so a second ticked line there would be drawn nowhere (see onlySeries). The rows
  // are radios then rather than boxes, and the menu closes on a press — picking one of a
  // list is one press, where assembling a set is several.
  single?: boolean;
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
    // thing several lines are for. Where only one may be lit there is no set to assemble, so
    // it closes on the press like any menu of alternatives.
    <MenuRoot closeOnSelect={single} positioning={{placement: 'bottom-end'}}>
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
            makes nine rows scannable: the letter that distinguishes LAeq,5m from LCeq,5m is
            the heading you are under rather than something to spot mid-word. It is also the
            only thing that distinguishes them on the chart, the two weightings of a quantity
            sharing a colour by design (see the series table). */}
        {groups.map(({weighting, unit, options}) =>
          single ? (
            // One of nine rather than some of nine, which is a radio group and not nine
            // boxes: the difference is the whole of what the map's menu has to say about
            // itself — ticking a second line there would silently unpick the first, and a
            // checkbox promising otherwise is the control lying about what it does.
            //
            // A radio group *per block*, with the heading inside it rather than one group
            // wrapped round both blocks: an item group nested in a radio group replaces the
            // group context with its own, which carries no value and no handler, so every
            // row came out unticked and every press did nothing. Two groups sharing one
            // value is not two choices either — the value is the page's single pick, so
            // picking in one block unticks the other as it must.
            <MenuRadioItemGroup
              key={weighting}
              // The lit line, which for a single pick is the whole of it (see primarySeries).
              value={primarySeries(picked)}
              // The row's own value read back as the series it came from rather than trusted
              // as one: the table is the one place the keys are written down.
              onValueChange={({value}) => {
                const key = SERIES_KEYS.find((k) => k === value);
                if (key) onToggleSeries(key);
              }}
            >
              <MenuItemGroupLabel userSelect="none">{unit}</MenuItemGroupLabel>
              {options.map(({key, label}) => (
                <MenuRadioItem key={key} value={key}>
                  {label}
                </MenuRadioItem>
              ))}
            </MenuRadioItemGroup>
          ) : (
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
              {/* The timeframe's Leq, last in the block it is read in — which is the
                  primary pick's weighting, so the row moves between the two blocks as
                  the pick above it changes, and is named for the block it is in.
                  Under `dB(A)` rather than under a rule below both, because it is a
                  dB(A) reading: filed outside them it read as a third unit, and the one
                  thing its label has to say is which of the two it comes out in.

                  Still last of its block, and after the five series, because it is not one
                  of them: no line is drawn for it and no cursor reads it — it is the average
                  over whatever the timeline is cropped to, printed on the cards (see
                  LocationReadings). Offered only where a card prints it, which is why both
                  it and its toggle are optional (see the props).

                  Greyed while live, where there is no timeframe to average and the row would
                  promise a number the page cannot produce. */}
              {onToggleRangeLeq && weighting === primaryWeighting(picked) && (
                <MenuCheckboxItem
                  value="range"
                  checked={Boolean(rangeLeq)}
                  disabled={live}
                  onCheckedChange={onToggleRangeLeq}
                >
                  {range}
                </MenuCheckboxItem>
              )}
            </MenuItemGroup>
          ),
        )}
      </MenuContent>
    </MenuRoot>
  );
});
