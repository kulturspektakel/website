import {Box, HStack, IconButton, Text} from '@chakra-ui/react';
import {memo, useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {DeviceIdentity, LocationReadings} from './LocationReadings';
import {LocationChart} from './LocationChart';
import {LocationAssignmentsDialog} from './LocationAssignmentsDialog';
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
// named, the same two numbers are printed and the same ⋮ is there to press however far
// back you have scrubbed. A card whose contents appeared and vanished as the pointer
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
// animation frame, doesn't re-render this card's ⋮ menu and its two monitors' names
// for it. What does follow the playhead is the leaf below, and it reads
// it itself.
export const LocationCard = memo(function LocationCard({
  location,
  assignments,
}: {
  location: NoiseLocationItem;
  // The monitors standing here at the instant being viewed, resolved by the layout for
  // the whole page. Only the numbers use them: the names and the chart are the place's
  // whole history, and are not allowed to come and go as the pointer travels.
  assignments: NoiseAssignment[];
}) {
  const [editing, setEditing] = useState(false);

  // Every monitor this location has ever had, once each and in the order it first had
  // them. Grouped once here and handed to both the names and the chart, so the two are
  // the same set in the same order by construction rather than by two calls agreeing.
  const lines = locationLines(location.assignments);

  return (
    // A card is either on the list or not on it at all — which of them are is picked in
    // the toolbar at the foot of the view (see LocationPicker), not by folding them one
    // at a time. So there is no disclosure here any more: a card that is here is open,
    // and a chart nobody wants is one that was never mounted.
    <Box
      display="flex"
      flexDirection="column"
      gap="2"
      p="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
      // The cards share the page equally, which the grid around them does by making
      // every row the same height (see the list view) — including the width, at two
      // columns. All this has to do is not insist on being taller than its share; the
      // chart inside has the floor that stops the rows collapsing into slivers and
      // starts the list scrolling instead.
      minH="0"
    >
      <HStack justify="space-between" align="center" gap="3">
        {/* Nothing clickable in here any more: the name and its monitors are what the
            card is about, and the two things you can do to it — take it off the list,
            edit it — are the toolbar below and the ⋮ beside it. */}
        <HStack flex="1" minW="0" gap="2">
          <Box minW="0" flex="1">
            <Text fontWeight="bold" truncate>
              {location.locationName}
            </Text>
            {/* Which monitors have stood here, always — the coordinates this line used
                to fall back to were placed on the map, never change, and are not
                something anyone reads a noise list for. Wrapped rather than truncated
                as a set: with two monitors the second name is not a detail. */}
            <HStack gap="3" wrap="wrap" minW="0">
              {lines.map(({deviceId}) => (
                <DeviceIdentity key={deviceId} deviceName={deviceId} />
              ))}
            </HStack>
          </Box>
        </HStack>
        <LocationLevels
          locationId={location.id}
          assignments={assignments}
          empty={lines.length === 0}
        />
        {/* Always here, and always the ⋮: a location with no monitor is exactly the one
            you came to the card to assign one to, and a labelled button that appeared
            only there would move the whole right-hand side of the row the moment it
            got one.
            A menu even at one entry — everything else this card will grow (renaming
            the place, moving its pin, deleting it) belongs behind the same ⋮, and a
            button that opened a dialog directly would have to become one anyway. */}
        <MenuRoot>
          <MenuTrigger asChild>
            <IconButton
              aria-label="Standort bearbeiten"
              rounded="full"
              size="sm"
              flexShrink="0"
              variant="ghost"
            >
              <LuEllipsisVertical />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem value="devices" onClick={() => setEditing(true)}>
              Geräte verwalten
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      </HStack>

      <LocationAssignmentsDialog
        open={editing}
        onClose={() => setEditing(false)}
        location={location}
      />

      {/* Everything else the card carries is in the header, so what is left inside is
          the chart — and it is here whether or not anything is standing at this
          location, because it is a chart of the place rather than of its monitors. */}
      {/* The card's one growing part, so the height it was given lands on the chart
          rather than as a gap under it. */}
      <LocationChart lines={lines} />
    </Box>
  );
});

// The readings beside a location's name — the place's Leq over the crop, and what the
// loudest monitor standing here reads at the playhead.
//
// Its own component so that it, and not the card around it, is what re-renders as the
// pointer travels over a trace: the second, tagged number it prints is the instant's.
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
  const {live, metric, weighting, locationTotals} = useProjectView();
  const levels = usePlayheadLevels();
  if (empty) return null;

  return (
    <LocationReadings
      assignments={assignments}
      total={locationTotals?.[locationId]}
      levels={levels}
      live={live}
      metric={metric}
      weighting={weighting}
    />
  );
}
