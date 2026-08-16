import {Box, HStack, IconButton, Text} from '@chakra-ui/react';
import {memo, useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {LocationReadings} from './LocationReadings';
import {DeviceBadges} from './DeviceBadge';
import {LocationChart} from './LocationChart';
import {LocationAssignmentsDialog} from './LocationAssignmentsDialog';
import {LocationLimitsDialog} from './LocationLimitsDialog';
import {
  locationLines,
  usePlayheadLevels,
  useProjectView,
  type NoiseAssignment,
  type NoiseLocationItem,
} from './projectView';

// One place on the list, and one row for it however many monitors have stood there. The
// card *is* that row: the monitors' names take the line the coordinates used to have,
// the readings sit beside the menu, at the top where they are read first,
// and the chart below is the location's, over the whole crop.
//
// A row per monitor is what this replaced. It said the same thing twice for the
// ordinary location, which has one, and for the rare one with two it stacked two
// charts that had to be read against each other by eye rather than drawn on one pair
// of axes.
//
// What the card *shows* never comes and goes with the playhead — the same monitors are
// named, one number per picked window is printed and the same ⋮ is there to press however
// far back you have scrubbed. A card whose contents appeared and vanished as the pointer
// travelled would reflow the list under the cursor.
//
// What those numbers *mean* does follow it, and that is the split worth knowing: the
// names and the chart are the place's whole history, while the readings are the place at
// one instant — the loudest of the monitors actually standing here then (see
// LocationReadings). So the header can name a monitor that has nothing to say right now,
// which is the honest answer rather than a row that disappears.
//
// Everything page-wide comes from the context rather than down through the list: this
// renders inside the very provider ProjectListView read from, and threading the
// display settings would mean a third place to edit for every one added.
//
// Memoized, and its one prop is pinned by the layout for it (see ProjectViewCtx.
// locations) — so a hover over any trace on the page, which moves the playhead on every
// animation frame, doesn't re-render this card's ⋮ menu and its monitors' names
// for it. What does follow the playhead is the leaf below, and it reads
// it itself.
export const LocationCard = memo(function LocationCard({
  location,
  assignments,
  onHide,
  hideable,
}: {
  location: NoiseLocationItem;
  // The monitors standing here at the instant being viewed, resolved by the layout for
  // the whole page. Only the numbers use them: the names and the chart are the place's
  // whole history, and are not allowed to come and go as the pointer travels.
  assignments: NoiseAssignment[];
  // Takes this card off the list — the same decision the roster in the toolbar makes, and
  // the same stored arrangement (see locationSelection.ts). Handed down as the toggle
  // itself rather than as a closure over this location's id: the list view re-renders on
  // every frame of a crop drag, and a fresh function per card would cost this card's memo
  // exactly the re-render it exists to avoid.
  onHide: (locationId: string) => void;
  // Whether taking it off is a thing that can happen — false for the last card, which the
  // list keeps (see toggledSelection).
  hideable: boolean;
}) {
  // One nullable pick rather than a boolean each, so the two editors of this location
  // cannot be open over one another — and so the next thing behind the ⋮ is a name in
  // this union rather than a third piece of state.
  const [dialog, setDialog] = useState<'devices' | 'limits' | null>(null);

  // Every monitor this location has ever had, once each and in the order it first had
  // them. Grouped once here and handed to both the names and the chart, so the two are
  // the same set in the same order by construction rather than by two calls agreeing.
  const lines = locationLines(location.assignments);

  return (
    // A card is either on the list or not on it at all, never folded shut: there is no
    // disclosure here, a card that is here is open, and a chart nobody wants is one that
    // was never mounted. Which of them are on the list is the roster in the toolbar at the
    // foot of the view (see LocationPicker), and — for the one in front of you — the ⋮
    // below, which is that same decision reached from the other end.
    <Box
      display="flex"
      flexDirection="column"
      gap="2"
      px="3"
      // Less above and below than beside: what the card is short of is height — the chart
      // gets whatever the header leaves — and the readings now carry their own boxes, which
      // hold the header off the border without the card's own padding doing it.
      py="2"
      rounded="md"
      borderWidth="1px"
      borderColor="border.emphasized"
      // The cards share the page equally, which the grid around them does by making
      // every row the same height (see the list view) — including the width, at two
      // columns. All this has to do is not insist on being taller than its share; the
      // chart inside has the floor that stops the rows collapsing into slivers and
      // starts the list scrolling instead.
      minH="0"
    >
      <HStack justify="space-between" align="center" gap="3">
        {/* The place's own name isn't clickable: a location has no page of its own, and
            the two things you can do to it — take it off the list, edit it — are the
            toolbar below and the ⋮ beside it. The monitors under it do have a page each,
            and their badges link to it. */}
        <Box flex="1" minW="0">
          <Text fontWeight="bold" truncate>
            {location.locationName}
          </Text>
          {/* Which monitors have stood here — the coordinates this line used to fall
                back to were placed on the map, never change, and are not something
                anyone reads a noise list for. One line of them, as many as fit at a
                width that still names them; the rest are behind the ⋮ (see
                DeviceBadges). */}
          <DeviceBadges lines={lines} />
        </Box>
        <LocationLevels
          locationId={location.id}
          assignments={assignments}
          empty={lines.length === 0}
        />
        {/* Always here, and always the ⋮: a location with no monitor is exactly the one
            you came to the card to assign one to, and a labelled button that appeared
            only there would move the whole right-hand side of the row the moment it
            got one.
            Everything else this card will grow (renaming the place, moving its pin,
            deleting it) belongs behind the same ⋮ — as does taking this card off the
            list, which is the one item there that isn't about the location at all. */}
        <MenuRoot>
          <MenuTrigger asChild>
            <IconButton
              aria-label="Edit location"
              rounded="full"
              size="sm"
              flexShrink="0"
              variant="ghost"
            >
              <LuEllipsisVertical />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem value="devices" onClick={() => setDialog('devices')}>
              Manage devices
            </MenuItem>
            {/* What this place is permitted, which the chart below draws as a rule per
                limit over the hours it covers. Only the timing and the number are edited
                here — a limit is read off the trace it is a limit on, not off a list. */}
            <MenuItem value="limits" onClick={() => setDialog('limits')}>
              Manage limits
            </MenuItem>
            {/* Ruled off and last: the two above edit the place, this one only dismisses
                the card. Nothing is deleted and nobody else's page changes — it is the
                roster's untick, reached from the card instead of from a dozen rows at
                the foot of the page, and the roster is where it is undone.
                Greyed out on the last card rather than quietly doing nothing, which is
                where this parts company with the roster: there, a dead row among many
                would read as "unavailable" when the truth is the opposite, so the tick
                stays live and is ignored (see toggledSelection). Here the menu is this
                card's and the hide is the only one in it — a press that visibly did
                nothing would just be a broken button. */}
            <MenuSeparator />
            <MenuItem
              value="hide"
              disabled={!hideable}
              onClick={() => onHide(location.id)}
            >
              Hide
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      </HStack>

      <LocationAssignmentsDialog
        open={dialog === 'devices'}
        onClose={() => setDialog(null)}
        location={location}
      />
      <LocationLimitsDialog
        open={dialog === 'limits'}
        onClose={() => setDialog(null)}
        location={location}
      />

      {/* Everything else the card carries is in the header, so what is left inside is
          the chart — and it is here whether or not anything is standing at this
          location, because it is a chart of the place rather than of its monitors. */}
      {/* The card's one growing part, so the height it was given lands on the chart
          rather than as a gap under it. */}
      {/* The place's whole permit, not the limits in force at the playhead: the chart
          spans the crop, so a limit that lapsed at midnight belongs on a crop that covers
          midnight — the same reason `lines` is the whole assignment history. */}
      <LocationChart lines={lines} limits={location.limits} />
    </Box>
  );
});

// The readings beside a location's name — what the loudest monitor standing here reads at
// the playhead, one number per window the page is drawing, and the place's Leq over the
// crop after them.
//
// Its own component so that it, and not the card around it, is what re-renders as the
// pointer travels over a trace: every tagged number it prints is the instant's.
// Both halves of the page's state are read here rather than passed down for the same
// reason — the card holds still through a crop drag except for these numbers, so
// subscribing the leaf and not its parent keeps a drag off every card's header and ⋮. Same arrangement LocationChart uses, and why both take only what is theirs.
function LocationLevels({
  locationId,
  assignments,
  empty,
}: {
  locationId: string;
  // Resolved at the playhead by the layout — the monitors whose readings are this
  // location's at the instant being viewed.
  assignments: NoiseAssignment[];
  // Whether the place has never had a monitor at all, which is the one case with
  // nothing to print. Not `assignments.length`: a location between two placements has
  // no monitor *now* and still has a crop Leq to show.
  empty: boolean;
}) {
  const {live, picked, locationTotals} = useProjectView();
  const levels = usePlayheadLevels();
  if (empty) return null;

  return (
    <LocationReadings
      assignments={assignments}
      // Whatever there is, unconditionally: whether this reading is wanted at all is
      // settled where it is produced, so a card has no gate of its own to get wrong (see
      // ProjectViewCtx.locationTotals).
      total={locationTotals?.[locationId]}
      levels={levels}
      live={live}
      picked={picked}
    />
  );
}
