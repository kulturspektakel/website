import {Box, Collapsible, HStack, Text} from '@chakra-ui/react';
import {memo} from 'react';
import {LuChevronDown} from 'react-icons/lu';
import {DeviceIdentity, DeviceLevels, DeviceRowFrame} from './DeviceRow';
import {LevelTrace} from './LevelTrace';
import {AssignDeviceMenu, LocationDeviceMenu} from './AssignDeviceMenu';
import {
  usePlayheadLevels,
  useProjectView,
  type NoiseAssignment,
  type NoiseLocationItem,
} from './projectView';
import type {LevelMetric} from './level';
import type {Weighting} from './noise';
import type {RangeTotals} from './projectLogs';

// One place on the list, and one row for it however many monitors stand there. The
// card *is* that row: the monitors' names take the line the coordinates used to have,
// the readings sit beside the menu — where they stay legible with the card collapsed —
// and the trace below plots a line each.
//
// A row per monitor is what this replaced. It said the same thing twice for the
// ordinary location, which has one, and for the rare one with two it stacked two
// charts that had to be read against each other by eye rather than drawn on one pair
// of axes.
//
// Everything page-wide comes from the context rather than down through the list: this
// renders inside the very provider ProjectListView read from, and threading the
// display settings would mean a third place to edit for every one added.
//
// Memoized, and both props are pinned by the layout for it (see ProjectViewCtx.
// locations) — so a hover over any trace on the page, which moves the playhead on every
// animation frame, doesn't re-render this card's disclosure, its ⋮ menu and its two
// monitors' names for it. What does follow the playhead is the two leaves below it, and
// they read it themselves.
export const LocationCard = memo(function LocationCard({
  location,
  assignments,
}: {
  location: NoiseLocationItem;
  // The monitors that stood here at the instant being viewed — which while live means
  // the ones standing here now, and while scrubbing may be ones that have since moved
  // on. Resolved by the layout, which does it for every location at once.
  assignments: NoiseAssignment[];
}) {
  const {
    live,
    metric,
    weighting,
    range,
    totals,
    traces,
    refresh,
    scrubTo,
    cropTo,
  } = useProjectView();
  const devices = assignments.map((a) => a.deviceId);
  const hasDevices = assignments.length > 0;

  return (
    // Chakra's own disclosure rather than a `useState` and a conditional: it owns the
    // trigger/content wiring (aria-expanded, aria-controls, the ids) and the height
    // transition, none of which is worth hand-rolling per card.
    //
    // unmountOnExit, because the content is a chart: left mounted it would keep a
    // uPlot instance alive and reposition a playhead on every frame anyone hovers a
    // trace anywhere on the page, so a closed card would cost as much as an open one.
    // Rebuilding on expand is cheap at this size. Open to begin with — a list you have
    // to unfold before it says anything is a worse first paint than a long one.
    <Collapsible.Root
      defaultOpen
      unmountOnExit
      display="flex"
      flexDirection="column"
      gap="2"
      p="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
    >
      {/* Centred when the right-hand side has to line up against a two-line title
          block, top-aligned when there is only the button to place. */}
      <HStack
        justify="space-between"
        align={hasDevices ? 'center' : 'start'}
        gap="3"
      >
        {/* The whole title block is the trigger rather than a chevron button beside
            it: at phone width a lone icon is a target you miss, and there is nothing
            else in the block that wants a click of its own. The menu stays outside it,
            so it keeps its own click and the two don't nest.
            Laid out on the trigger itself rather than `asChild` onto an HStack, which
            would merge it onto a div and quietly drop the button — its focus, its
            Enter and Space. */}
        <Collapsible.Trigger
          flex="1"
          minW="0"
          display="flex"
          alignItems="center"
          gap="2"
          textAlign="left"
          cursor="pointer"
        >
          <Collapsible.Indicator
            color="gray.400"
            flexShrink="0"
            display="flex"
            // Pointing right when closed, down when open — one icon rotated, which
            // is what makes it animate rather than swap.
            rotate={{base: '-90deg', _open: '0deg'}}
            transition="rotate 0.2s"
          >
            <LuChevronDown />
          </Collapsible.Indicator>
          <Box minW="0" flex="1">
            <Text fontWeight="bold" truncate>
              {location.locationName}
            </Text>
            {/* Which monitors stand here beats where here is: the coordinates were
                placed on the map and never change. Boxes and text, nothing focusable,
                so the whole block stays one trigger. Wrapped rather than truncated as
                a set — with two monitors the second name is not a detail. */}
            {hasDevices ? (
              <HStack gap="3" wrap="wrap" minW="0">
                {devices.map((deviceId) => (
                  <DeviceIdentity key={deviceId} deviceName={deviceId} />
                ))}
              </HStack>
            ) : (
              <Text fontSize="xs" color="gray.500">
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Text>
            )}
          </Box>
        </Collapsible.Trigger>
        {/* Assigning is a now-action, so it stays put however far back you scrub. The
            labelled button only where the card would otherwise hold nothing at all —
            everywhere else the ⋮ carries it, alongside the readings and removing what
            is already here. */}
        {hasDevices ? (
          <>
            <LocationLevels
              assignments={assignments}
              live={live}
              metric={metric}
              weighting={weighting}
              totals={totals}
            />
            <LocationDeviceMenu
              locationId={location.id}
              // Only open assignments can be ended; ones you scrubbed back to are
              // history, and offering to end them again would be nonsense.
              assignments={assignments.filter((a) => a.end == null)}
              onChanged={refresh}
            />
          </>
        ) : (
          <AssignDeviceMenu locationId={location.id} onAssigned={refresh} />
        )}
      </HStack>

      <Collapsible.Content>
        {!hasDevices ? (
          <Text fontSize="sm" color="gray.500">
            {live
              ? 'Kein Gerät zugewiesen.'
              : 'Zu diesem Zeitpunkt kein Gerät.'}
          </Text>
        ) : (
          // Everything else the row carries is in the header, so what is left inside
          // is the trace — in a box of its own, so the levels are framed rather than
          // bleeding into the card's own padding.
          <DeviceRowFrame>
            <LevelTrace
              devices={devices}
              live={live}
              // The header's window — the same one the traces were built for, and the
              // same one the coloured number above is read in.
              metric={metric}
              weighting={weighting}
              range={range}
              // Hovering any trace moves the page's playhead, which is what puts the
              // line in the same place on every other card and on the timeline.
              // Withheld while live for the same reason there is no line then: there
              // is nothing for it to move.
              onScrub={live ? undefined : scrubTo}
              // `i`/`o` over the trace, or a drag across it, crop the page's timeframe
              // to what was pointed at. Withheld while live for the same reason as the
              // playhead: the window follows the clock then, and a crop inside it
              // would be overwritten a second later.
              onCrop={live ? undefined : cropTo}
              series={traces}
            />
          </DeviceRowFrame>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
});

// The readings beside a location's name, which are the one thing in the card's header
// that follows the playhead.
//
// Its own component so that it, and not the card around it, is what re-renders as the
// pointer travels over a trace.
//
// DeviceLevels itself is left alone deliberately, and not because it also serves a page
// with no playhead: it takes a resolved number per monitor, and reading the playhead
// there would mean handing a leaf the whole page's lookup table to pick its own out of.
// Resolving that table into one reading per monitor is this component's entire job.
function LocationLevels({
  assignments,
  live,
  metric,
  weighting,
  totals,
}: {
  assignments: NoiseAssignment[];
  live: boolean;
  metric: LevelMetric;
  weighting: Weighting;
  totals?: Record<string, RangeTotals>;
}) {
  const levels = usePlayheadLevels();
  return (
    <DeviceLevels
      devices={assignments.map((a) => ({
        deviceName: a.deviceId,
        lastSeen: a.lastSeen,
        historyDb: levels?.[a.deviceId],
        total: totals?.[a.deviceId],
      }))}
      live={live}
      metric={metric}
      weighting={weighting}
    />
  );
}
