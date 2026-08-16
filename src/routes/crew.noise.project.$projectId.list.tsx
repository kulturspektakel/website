import {createFileRoute, useLocation} from '@tanstack/react-router';
import {Box, HStack, Text} from '@chakra-ui/react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {LocationCard} from '../components/noise/LocationCard';
import {LocationPicker} from '../components/noise/LocationPicker';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../components/chakra-snippets/native-select';
import {
  COLUMNS,
  useListColumns,
  type Columns,
} from '../components/noise/listColumns';
import {
  focusSelection,
  readSelection,
  resolveSelection,
  toggledSelection,
  writeSelection,
} from '../components/noise/locationSelection';
import {useProjectView} from '../components/noise/projectView';

// The counts as the picker says them. Named by what the arrangement *is* rather than by a
// word for it: "Raster" was a third entry in the header's view switcher, and what it
// actually picked was how wide the cards are. The counts themselves, and the fact that they
// are remembered, belong to listColumns.ts.
const COLUMN_OPTIONS = COLUMNS.map((n) => ({
  value: String(n),
  label: n === 1 ? '1 column' : `${n} columns`,
}));

// What is on the list before there is a list — the frame before the store has been read.
// One set rather than a fresh one per render, because it is a prop of a memoized picker.
const NOTHING_SHOWN: ReadonlySet<string> = new Set();

export const Route = createFileRoute('/crew/noise/project/$projectId/list')({
  // No search of its own any more: the column count used to live here, and is now stored per
  // browser instead (see listColumns.ts for why). Everything else this view reads off the
  // URL — live, and the moment being looked at — belongs to the layout above it.
  component: ProjectListView,
});

function ProjectListView() {
  // The layout resolves each location's monitors at the playhead, which the map's pins
  // need; a card is about the place over the whole crop and reads the location itself.
  const {project, locations} = useProjectView();
  // How wide the cards are, and it is remembered — per browser rather than per project, and
  // not in the URL (see listColumns.ts). One column until the stored value is read, which is
  // the frame after mount.
  const [cols, pickCols] = useListColumns();
  // The place someone pressed to get here, if they pressed one — a pin on the map, the chip
  // on a monitor's page. Off the history entry rather than the URL (see
  // locationSelection.ts), and selected rather than merely read: it is the whole reason the
  // list is on screen. Undefined for every other way in, which is most of them.
  const focus = useLocation({select: (l) => l.state.focusLocation});

  // The roster: every location the project has, in the one order there is (the layout
  // sorted them — see compareLocations). Both the menu and the stored ids follow it.
  //
  // Pinned on `locations`, which the layout has already pinned on the assignments in
  // effect: this is a prop of the picker, and the picker is memoized. A fresh array here
  // would hand it a new identity on every animation frame of a crop drag — that gesture
  // re-renders this view through the context — and a closed menu would reconcile all of
  // its rows sixty times a second for a roster that had not changed.
  const roster = useMemo(
    () => locations.map(({location}) => location),
    [locations],
  );

  // Which locations are on the list, and it is remembered — per project, in this browser
  // (see locationSelection.ts). The cards divide the page's height between them, so this
  // is the decision that governs whether the view is readable at all, and having it back
  // at everything after a trip to the map meant re-making it every time. A fresh browser
  // starts on the first three.
  //
  // Empty until the store has been read, which is the frame after mount (see the effect),
  // and empty renders no cards. Not the default set standing in for the answer: that put
  // three particular charts on screen and then replaced them a frame later with the ones
  // you had arranged, which reads as the page changing its mind about what you asked for.
  // An empty grid for a frame is the honest version — it says nothing rather than
  // something wrong — and it is the same frame the column count arrives on, so the first
  // cards painted are the right cards at the right width.
  //
  // Empty and not a separate null, though it was: "nothing yet" and "nothing" are the same
  // state to everything downstream, and the two spellings meant three null branches and
  // this constant for one frame of one render. An empty set is otherwise unreachable — a
  // project with no locations returns early below, and toggledSelection refuses to remove
  // the last id.
  const [selected, setSelected] = useState<ReadonlySet<string>>(NOTHING_SHOWN);

  // The stored value is read after mount rather than in the initializer above, and that
  // is the whole reason this is an effect: the page is server-rendered, and a lazy
  // initializer reading localStorage would hand hydration a different set of cards than
  // the server sent. Same shape as CrewCardInfo. No cards are on screen for the frame in
  // between, which is why the state starts null rather than on the default.
  // And the same effect is where a handed-over location lands, because the two are one
  // decision — what the list opens on — and running them in either order would show the
  // stored arrangement for a frame before replacing it. Stored as well as shown, so it is
  // the arrangement from here on: a trip to the map and back returns to that one place
  // rather than to whatever was on the list before it was pressed.
  useEffect(() => {
    const focused = focusSelection(focus, roster);
    if (focused) writeSelection(project.id, focused);
    setSelected(
      new Set(focused ?? resolveSelection(readSelection(project.id), roster)),
    );
    // roster is deliberately not a dependency: what this reads is the store, once per
    // project, and the roster follows the assignments in effect as well as the project it
    // belongs to. A location added afterwards is picked up by the roster menu and the map,
    // and stays off the list until it is ticked.
  }, [project.id, focus]);

  // Computed here and not inside the updater: React invokes updaters twice in
  // development, and writing to storage is not the kind of thing to do twice.
  //
  // The arrangement comes back as an ordered list of the places that still exist (see
  // toggledSelection, which is also what keeps the last card on the list), which is
  // exactly what is worth storing; the set is this render's reading of it.
  //
  // Pinned like the roster above, and for the same reason: it is the picker's other prop.
  const toggle = useCallback(
    (locationId: string) => {
      // Nothing to toggle before the store has been read: the arrangement this would be
      // amending does not exist yet, and taking the press as "this one alone" would write
      // over what is about to arrive. One frame's worth of presses, and the roster shows
      // nothing ticked during it, so there is nothing on screen inviting one.
      if (selected.size === 0) return;
      const next = toggledSelection(selected, locationId, roster);
      setSelected(new Set(next));
      writeSelection(project.id, next);
    },
    [selected, roster, project.id],
  );

  if (locations.length === 0) {
    return (
      <Text color="fg.subtle" p="4">
        {/* A location can only be placed on the map, so without a Maps key there
            is no way in at all — say so rather than showing an empty list and no
            control. */}
        {project.apiKey != null
          ? 'No locations yet.'
          : 'No locations yet. Without a Google Maps key the map is unavailable, so no locations can be added at the moment.'}
      </Text>
    );
  }

  const shown = locations.filter(({location}) => selected.has(location.id));
  // What the grid is actually laid out in: what was picked, or the number of cards when
  // that is fewer. At least one, for the frame after a navigation to another project where
  // there are none (see the grid below).
  const columns = Math.max(1, Math.min(cols, shown.length));

  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0">
      {/* Its own gutter, unlike the map beside it: the content region is edge-to-edge
          now, and a column of bordered cards run right up against the window reads as a
          table that has lost its edge. The map wants the opposite and gets it.

          Fills what the toolbars leave, so the cards have something to divide: each
          takes an equal share of it (see LocationCard), which is what makes one location
          a full-page chart and four a quarter of one each — down to the trace's own
          floor, past which the list scrolls. */}
      <Box
        display="grid"
        // Never more columns than there are cards to put in them: two locations pinned to
        // the left two thirds with nothing beside them is a grid of two, and the room it
        // left empty is room their charts could have had. A partly filled *last* row is a
        // different thing and is left alone — the leftover cards simply sit in the first
        // columns, which is what a grid does, and stretching them would make one card
        // wider than the ones it is there to be compared with.
        gridTemplateColumns={`repeat(${columns}, minmax(0, 1fr))`}
        // Every row the same height, which is what divides the page between the cards —
        // a grid rather than a flex column even at one column, so the two layouts are
        // the same rule with a different column count. A row still can't be shorter
        // than the trace's own floor, and past that the list scrolls.
        gridAutoRows="1fr"
        gap="3"
        p="4"
        flex="1"
        minH="0"
      >
        {/* Never none of them: the picker refuses to take the last card off the list and
            a stored arrangement that resolves to nothing falls back to the default (see
            locationSelection.ts), so there is no empty state here to write. What is left
            are two frames: before the store has been read, and after a navigation to
            another project, where this still holds the previous one's ids. Both are one
            paint of an empty grid, and a message would be a sentence flashing up
            instead. */}
        {shown.map(({location, assignments}) => (
          <LocationCard
            key={location.id}
            location={location}
            assignments={assignments}
            // The same toggle the roster is given, so the ⋮ on a card and the tick in
            // the menu are one decision written down once. Pinned like the picker's
            // props, which is what keeps the card's memo through a crop drag.
            onHide={toggle}
            // The list keeps its last card (see toggledSelection), so that card's menu
            // says so instead of offering a press that would be ignored. Counted off
            // what is on screen rather than off the selection: the two differ only by
            // the ghosts of deleted locations.
            hideable={shown.length > 1}
          />
        ))}
      </Box>

      {/* The view's own toolbar, at the foot of it: which places are on the list, and how
          the cards are laid out. Both are decisions about *this* page's shape rather than
          about what you are looking at, which is what the header decides — so they are
          down here beside the thing they rearrange, and the header is two views wide.

          Sticks to the foot of the scroll box, so both are reachable without scrolling
          back down a list they are the controls for. Opaque and ruled off, like the
          toolbars at the top.

          One control at each end rather than the pair of them huddled on the left: they
          answer different questions — which places, how wide — and the gutter between
          them is what says so at a glance. The roster takes what is left over in the
          middle, which is also the one of the two whose label can be long. */}
      <HStack
        gap="2"
        px="4"
        py="2"
        justify="space-between"
        position="sticky"
        bottom="0"
        zIndex="2"
        flexShrink="0"
        bg="bg"
        borderTopWidth="1px"
        borderColor="border"
      >
        {/* The selection itself, not a set rebuilt from the cards on screen: the two only
            ever differ by ids of locations that have since been deleted, and the menu asks
            `shown.has` of the roster alone, where such an id cannot appear. Passing it
            straight is one representation of "what is on the list" instead of two that
            have to be kept in step — and it is the stable one, which is what the memo on
            the picker needs. */}
        <LocationPicker
          locations={roster}
          shown={selected}
          onToggle={toggle}
        />
        <ColumnPicker cols={cols} onPick={pickCols} />
      </HStack>
    </Box>
  );
}

// How many columns the cards are laid out in. A native select, being one of three fixed
// answers — the same control the header uses for the view, at the same size, so the page's
// two dropdowns are one kind of thing in two places. Not a checkbox menu like the roster at
// the other end of the strip: that picks a set, this picks one of a list, and the two
// controls looking different is the honest version of that.
//
// It navigates nowhere and writes no URL. The count is remembered per browser instead (see
// listColumns.ts, which is also where it says why), so this is a plain pick handed up to the
// view — the two controls in this strip both remember, and neither is in the address bar.
function ColumnPicker({
  cols,
  onPick,
}: {
  cols: Columns;
  onPick: (cols: Columns) => void;
}) {
  return (
    <NativeSelectRoot size="sm" w="auto" flexShrink="0">
      <NativeSelectField
        aria-label="Columns"
        // What was picked, not what the grid settled on: two cards in a three-column pick
        // are laid out in two (see the grid), and a select that corrected itself to "2
        // columns" would look like it had refused the press — then silently rearrange the
        // moment a third card was ticked on.
        value={String(cols)}
        // The option's own value read back as the count it came from, rather than trusted as
        // a number: the list of counts is the one place they are written down.
        onChange={(e) => {
          const picked = COLUMNS.find((n) => String(n) === e.target.value);
          if (picked) onPick(picked);
        }}
        items={COLUMN_OPTIONS}
      />
    </NativeSelectRoot>
  );
}
