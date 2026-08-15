import {HStack, Text} from '@chakra-ui/react';
import {Link} from '@tanstack/react-router';
import {useEffect, useRef, useState} from 'react';
import {Tooltip} from '../chakra-snippets/tooltip';
import {useBluetooth, useDeviceState, useTick} from './context';
import {
  compareDeviceIds,
  formatBatteryVolts,
  formatLastSeen,
  isFresh,
  lastSeenAt,
} from './noise';
import {Chip} from './Chip';
import {LiveStatusDot} from './LiveStatusDot';
import {type DeviceWindows} from './projectView';

// One badge tall, which is what makes the line a line: the badges wrap, and everything past
// the first row is cut off. Chakra's own minimum for a `sm` badge, so it is that height
// rather than a number that happens to look like it.
const ROW_H = '5';

/**
 * The monitors a location has had, as one line of badges: as many as the line holds at their
 * own width, and a count of whatever is left over.
 *
 * The badges keep their natural width — a name is either shown or it isn't, never squeezed
 * to three characters and an ellipsis — and the line is one badge tall and does not scroll,
 * because the card's spare height belongs to its chart and a second row of badges would come
 * out of the trace on exactly the locations with the most to plot.
 *
 * Which is the whole trick: the badges *do* wrap, onto rows nobody sees. Flex moves a badge
 * that doesn't fit down entirely rather than clipping it, so what is left on the first row is
 * exactly the set that fits, at their full width, with no measurement and no arithmetic —
 * the layout has already answered the question. All that is measured is which row each badge
 * landed on, and only to know how many to say are missing.
 *
 * By name, ascending, and never by anything else: a monitor keeps its place on the line for
 * as long as it is on it. Order by when the location got them and the badges reshuffle every
 * time an assignment is made or retimed — and the same two monitors sit in opposite orders
 * on two cards that had them in opposite orders, which is a difference nobody reading a list
 * of places is looking for. Numeric collation, so `kult-2` comes before `kult-10`.
 *
 * Which makes the ones counted the last by name rather than the least interesting. That is
 * the price of a fixed order, and the tooltip is what pays it: the names are one hover away,
 * and the whole list is behind the ⋮.
 */
export function DeviceBadges({lines}: {lines: DeviceWindows[]}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  // How many badges wrapped out of sight. Nothing is hidden until proven otherwise, so the
  // markup a card is served with names every monitor and no "+2" appears where the room for
  // two more has not been measured yet.
  const [hidden, setHidden] = useState(0);

  // Sorted here rather than at the caller: it is this component's layout that decides which
  // end of the order goes unnamed, so it is this component that owes the order.
  const sorted = [...lines].sort((a, b) =>
    compareDeviceIds(a.deviceId, b.deviceId),
  );
  // Which monitors, as something an effect can depend on: `lines` is rebuilt by the card on
  // every render, so depending on the array would tear the observer down and put it back for
  // a card that had merely re-rendered.
  const namesKey = sorted.map((l) => l.deviceId).join(' ');

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    // A badge that didn't fit sits on a row below the first, which is the only thing here
    // that has to be read: `offsetTop`, once the browser has done the wrapping.
    const count = () => {
      const badges = Array.from(row.children) as HTMLElement[];
      const first = badges[0]?.offsetTop ?? 0;
      setHidden(badges.filter((b) => b.offsetTop > first).length);
    };
    // Fires once on observe, so the count lands with the first layout rather than after a
    // paint of its own — which is also what recounts when the set of monitors changes, the
    // effect being re-run for it.
    const ro = new ResizeObserver(count);
    ro.observe(row);
    // The badges as well as the row they are in: a monitor coming online grows its own badge
    // by a dot's width, which can move where the line runs out while the row around it keeps
    // exactly the size the card gave it. Safe to watch both — a badge's width answers to its
    // name and its dot, never to how many of its neighbours are on screen, so nothing here
    // can chase its own tail.
    for (const badge of row.children) ro.observe(badge);
    return () => ro.disconnect();
  }, [namesKey]);

  return (
    // The count sits outside the wrapping row, so it is never itself a badge that could wrap
    // out of sight: the row gives up the width for it (the badges in it don't — they wrap
    // instead), and it stays at the end of the line where the monitors it stands for would
    // have been.
    <HStack gap="1.5" minW="0">
      <HStack
        ref={rowRef}
        gap="1.5"
        minW="0"
        wrap="wrap"
        // A cap and not a height, so a location nothing has ever stood at contributes no
        // empty strip under its name. Rows pinned to the top rather than left to share the
        // box: the first one has to be the whole of what is visible, and only the ones
        // under it may be cut.
        maxH={ROW_H}
        alignContent="flex-start"
        overflow="hidden"
      >
        {sorted.map(({deviceId, lastSeen}) => (
          <DeviceBadge
            key={deviceId}
            deviceName={deviceId}
            // The record's own answer to "when did we last hear from this", which is all a
            // freshly-opened page has for a monitor that went quiet before it loaded. The
            // badge takes the later of this and whatever has arrived since.
            lastSeen={lastSeen}
          />
        ))}
      </HStack>
      {hidden > 0 && (
        <MoreDevicesBadge
          names={sorted.slice(sorted.length - hidden).map((l) => l.deviceId)}
        />
      )}
    </HStack>
  );
}

// The monitors this location has had that the line has no room to name — a count, and
// their names on hover.
//
// A button, not a link: there is no one device to go to, and the ⋮ beside it is where the
// whole list is editable. Focusable all the same, so the names are reachable by keyboard
// and by tap rather than only by a pointer that happens to rest on it — the same reason the
// coverage warning across the header is one (see LocationReadings).
//
// Never shrinks and never truncates: it is three characters wide and the only thing saying
// that this header is not the whole list.
function MoreDevicesBadge({names}: {names: string[]}) {
  return (
    <Tooltip content={names.join(', ')} showArrow>
      {/* The same chip as the badges it stands for — it is one of them, counted. */}
      <Chip asChild flexShrink="0" cursor="default">
        <button
          type="button"
          aria-label={`Weitere Geräte: ${names.join(', ')}`}
        >
          +{names.length}
        </button>
      </Chip>
    </Tooltip>
  );
}

// One monitor, named — the thing a location's header lists, and the whole of what any
// view has to say about a device it is not itself about.
//
// A badge and not a line of text, because that is what it is: a small, bounded thing
// naming a piece of hardware, several of which sit beside each other at a location that
// has had several. Its own box is also what keeps a row of them readable as a set of
// monitors rather than as a run of names and dots that breaks wherever the text happens
// to run out — and what lets one leave the line whole when there is no room for it, rather
// than every one of them being squeezed until none is legible (see DeviceBadges).
//
// And a link, to that monitor's own page: the badge names the one thing on a location
// card that has somewhere else to be looked at — its history, its calibration, its
// bands — and a name that is the only route there should be the route there. `surface`
// rather than `subtle` for exactly that reason: the ring around it is what says this is
// a thing you can press, on a card where nothing else is.
//
// What it says beyond the name is only ever about *now*:
//
//   the dot     — that records are arriving: green while they are, blue while this is
//                 also the device connected over Bluetooth. Absent once the monitor goes
//                 quiet rather than turning grey, because a grey dot beside a green one is
//                 read as a state of the same kind, and this is the absence of one — a
//                 badge with nothing lit is the monitor that is not talking, and the row
//                 says which those are at a glance. Since when is the tooltip's answer.
//   the tooltip — whichever of the two facts about the monitor the dot has just raised,
//                 because they are the same question asked either side of the dot going
//                 out:
//
//                 alive   its cell voltage. In the tooltip rather than on the badge: a
//                         row of badges is read for which monitors are here and whether
//                         they are alive, while the charge on one of them is what you go
//                         looking for once, about one device — printed on every badge it
//                         cost the names the width instead. Only while alive, because it
//                         is sent on the live stream alone (see noise.proto), so a device
//                         that has gone quiet leaves its last reading behind in the
//                         buffer and a voltage from twenty minutes ago shown as current
//                         is worse than none.
//                 offline when we last heard from it, which is the only useful thing left
//                         to say and the first thing anyone asks of a badge with no dot.
//                         "Since when" is what separates a monitor somebody has just
//                         unplugged from one that has been down since yesterday, and the
//                         missing dot alone cannot tell them apart.
//
// Independent of which timeframe the page is showing, deliberately: whether a monitor is
// powered and talking is a fact about the monitor, not about the hour being looked at, and
// it is exactly what you want to know while reading an evening that has already happened.
// The numbers that *do* belong to the viewed instant are the location's, printed on the
// other side of the header (see LocationReadings).
//
// Everything comes out of the live context, so a caller needs to know nothing but the
// name. It ticks once a second for the freshness above, which is why this is a leaf: the
// card around it must not re-render for a dot.
export function DeviceBadge({
  deviceName,
  lastSeen,
}: {
  deviceName: string;
  // When the monitor was last heard from according to the record, which is what a page
  // opened this morning knows about a device that went quiet last night. The live context
  // only knows what has arrived since this tab did, so on its own it would report a
  // monitor that stopped an hour ago and one that has never existed identically — and
  // would call a device that was transmitting a second before the page loaded offline.
  lastSeen?: number | null;
}) {
  const state = useDeviceState(deviceName);
  const bluetooth = useBluetooth();
  const now = useTick();
  const batteryMv = state?.latest.batteryMv;
  // The record and the live store merged by the one rule for it, which is also what the
  // "last seen" line on the other side of this header reads (see lastSeenAt).
  const seen = lastSeenAt(lastSeen, state?.lastSeen);
  const alive = isFresh(seen, now);
  const ble = deviceName === bluetooth.deviceName;
  // Alive and mains-powered is the one case with nothing to add: the dot has said the
  // whole of it. `disabled` then renders the badge bare rather than arming a state
  // machine for an empty bubble.
  const tooltip = alive
    ? batteryMv != null
      ? `Akku ${formatBatteryVolts(batteryMv)}`
      : ''
    : seen != null
      ? `Zuletzt gesehen ${formatLastSeen(seen, now)}`
      : 'Nie gesehen';

  return (
    <Tooltip content={tooltip} disabled={tooltip === ''} showArrow>
      {/* Its own width and no less: a badge squeezed to share a line names nothing, so the
          row wraps it out of sight instead and counts it (see DeviceBadges). The one cap is
          the line itself — a single id long enough to outrun the whole card truncates rather
          than hanging off the end of it, which is the only case where the ellipsis is the
          lesser evil.
          asChild so the link *is* the badge — a badge wrapped in an anchor would put a
          second box around it and take the hover with it. */}
      <Chip pressable asChild flexShrink="0" maxW="full" minW="0">
        <Link
          to="/crew/lautstaerke/device/$device"
          params={{device: deviceName}}
        >
          {/* Only when there is something lit to show — see above. */}
          {(alive || ble) && <LiveStatusDot lastSeen={seen} ble={ble} />}
          {/* A span, because a badge is one: the default paragraph would be invalid
              inside it. */}
          <Text as="span" truncate minW="0">
            {deviceName}
          </Text>
        </Link>
      </Chip>
    </Tooltip>
  );
}
