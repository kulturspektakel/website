import {memo, useCallback, useEffect, useState} from 'react';
import {Box, Button, Span} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuItemGroup,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../chakra-snippets/native-select';
import {SERIES_KEYS, type SeriesKey} from './series';
import {
  onlySeries,
  primarySeries,
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
 * The set's identity is load-bearing: it goes into the project page's context and into the
 * memos that build the traces, so an unchanged pick has to come back as the *same* array.
 * toggledSeries promises that, which is why nothing here filters or sorts in place.
 */
export function useLevelPick({
  // Which page's remembered pick this is. Per page and not per section, because the three
  // pages that pick series want different sets of them — see seriesSelection.ts.
  store,
  // Whether the page has room for more than one. The map has not: a pin is a badge with one
  // number on it, so picking there replaces rather than adds (see onlySeries), the control is
  // LevelSelect rather than the menu, and what is stored is one key.
  single = false,
}: {
  store: SeriesStore;
  single?: boolean;
}): {
  picked: PickedSeries;
  toggleSeries: (key: SeriesKey) => void;
} {
  // The everyday series — what the menu was set to before it was remembered, and now only
  // what is on screen until the store has been read, which is the frame after mount (see
  // DEFAULT_PICK).
  const [picked, setPicked] = useState<PickedSeries>(DEFAULT_PICK.picked);

  // The stored state of the menu is read after mount rather than in the initializers above,
  // and that is the whole reason this is an effect: these pages are server-rendered, and a
  // lazy initializer reading localStorage would hand hydration different lines than the
  // server drew. Same arrangement as the column count and the location selection, and for
  // the same reason (see listColumns.ts).
  //
  // Keyed on the store, so it re-reads when the page switches views: the project layout owns
  // one pick and hands it to whichever of the two is on screen, and those two remember
  // separately. One frame of the previous
  // view's pick in between, which is the frame the route itself is changing on.
  useEffect(() => {
    setPicked((readStoredPick(store, single) ?? DEFAULT_PICK).picked);
  }, [store, single]);

  // Read off the render rather than out of an updater, which is what keeps the write to one:
  // React invokes updaters twice in development, and writing to storage is not the kind of
  // thing to do twice.
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
      writeStoredPick(store, {picked: next});
    },
    [picked, single, store],
  );
  return {picked, toggleSeries};
}

// The device page's and the project list's control: which of the nine lines the charts draw.
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
// count — nine options' worth of segments or chips would not fit in the header. Where only
// one series may be picked (the map), the page uses LevelSelect below instead.
//
// The first pick is what the button names on purpose: it is the series every single number
// on the page is read in (see primarySeries), so the control that sets it is also where that
// is stated.
//
// Memoized, because it is a child of a header that re-renders on every frame of a playhead
// hover and none of its props move while that happens: `picked` is identity-stable by
// toggledSeries' contract and the callback comes out of useLevelPick's useCallback. Nine
// checkbox rows in a portal that is mounted whether or not the menu is open is not a
// subtree worth rebuilding sixty times a second for no change.
export const LevelPicker = memo(function LevelPicker({
  live,
  picked,
  onToggleSeries,
}: {
  // To label: the finest window is 1 s live and 1 min stored. Every series means the same
  // thing in either mode.
  live: boolean;
  picked: PickedSeries;
  onToggleSeries: (key: SeriesKey) => void;
}) {
  const groups = live ? GROUPS.live : GROUPS.stored;
  // What the button has to account for: the picked series, of which the first is named.
  const shown = picked.map((key) => seriesLabel(key, live));

  return (
    // Stays open while boxes are ticked: picking a set is several presses, and a menu that
    // closed after each would have to be reopened to compare two series — which is the very
    // thing several lines are for.
    <MenuRoot closeOnSelect={false} positioning={{placement: 'bottom-end'}}>
      <MenuTrigger asChild>
        {/* Outlined at the size of the controls it sits among, so the strip reads as one
              row rather than a button dropped into it. */}
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
      </MenuContent>
    </MenuRoot>
  );
});

// The project map's control: the one series every pin shows.
//
// A native select, now that one of nine is all it picks: the menu above exists for the set,
// and without one a select is the same choice in less code, with the platform's own picker
// on a phone. The two weightings are optgroups headed by their unit, which is the same
// grouping the menu's blocks are (see there for why the heading matters).
//
// Memoized for the same reason as the menu: its header re-renders every frame of a hover.
export const LevelSelect = memo(function LevelSelect({
  live,
  picked,
  onPick,
}: {
  live: boolean;
  picked: PickedSeries;
  onPick: (key: SeriesKey) => void;
}) {
  const groups = live ? GROUPS.live : GROUPS.stored;
  return (
    <NativeSelectRoot size="xs" w="auto">
      <NativeSelectField
        aria-label="Value shown"
        value={primarySeries(picked)}
        // The option's value read back as the series it came from rather than trusted as
        // one: the table is the one place the keys are written down.
        onChange={(e) => {
          const key = SERIES_KEYS.find((k) => k === e.target.value);
          if (key) onPick(key);
        }}
      >
        {groups.map(({weighting, unit, options}) => (
          <optgroup key={weighting} label={unit}>
            {options.map(({key, label}) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelectField>
    </NativeSelectRoot>
  );
});
