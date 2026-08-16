import {Link} from '@tanstack/react-router';
import {Box, HStack, Span, Text} from '@chakra-ui/react';
import {FaChevronRight} from 'react-icons/fa6';
import {LuMapPin} from 'react-icons/lu';
import {type NoiseMonitorDevice} from '../../routes/crew.noise';
import {BatteryChip} from './BatteryChip';
import {Chip} from './Chip';
import {LiveStatusDot} from './LiveStatusDot';
import {useBluetooth, useDeviceState, useNowAfterMount} from './context';
import {formatSeen, isFresh, lastSeenAt} from './noise';
import {displayedLevel, formatDb, metricTag, weightingUnit} from './level';

// One monitor in the landing page's list: what it is called, where it is standing, how
// loud it is and whether we are still hearing from it. The way into a device's page, and
// for a monitor that belongs to no project the only way there.
//
// A leaf of its own, like every other live readout in this section (see DeviceBadge,
// LocationReadings): it subscribes to this monitor's records and holds a clock, and read
// in the list instead, a record arriving for any one device would wake every row and the
// projects above them.
export function DeviceRow({device}: {device: NoiseMonitorDevice}) {
  const state = useDeviceState(device.id);
  const bluetooth = useBluetooth();
  // Withheld for the first paint, because here the clock decides *layout* rather than a
  // colour: the row shows a light or a "last seen" in the same slot, and never both. The
  // database's lastSeen is bumped on every upload (see touchDevice), so a healthy
  // monitor's is routinely inside the freshness window when the server renders this and
  // outside it a moment later in the browser — which is a dot on one and a sentence on
  // the other. suppressHydrationWarning covers text that differs, not markup that does.
  // Name and placement come from the loader, so the row is not empty meanwhile.
  const now = useNowAfterMount(1000);
  // The record and the live store, merged by the one rule for it (see lastSeenAt): the
  // table is all we know about a monitor that went quiet before this tab connected.
  const seen = lastSeenAt(device.lastSeen, state?.lastSeen);
  const alive = now != null && isFresh(seen, now);
  // Fixed at the finest Leq under A-weighting: this page has no picker, and those are
  // what one is offered by default where there is one (see useLevelPick) — the everyday
  // reading, and the one a limit is usually written against. Through displayedLevel
  // rather than liveDb directly, so the deliberate gap between the level's window and
  // the dot's holds here too: the light goes out a few seconds before the last number
  // fades, instead of the row emptying all at once.
  const level =
    now == null
      ? ({kind: 'none'} as const)
      : displayedLevel({
          live: true,
          now,
          metric: 'eq_fast',
          weighting: 'A',
          state,
        });
  const batteryMv = state?.latest.batteryMv;

  return (
    // The project rows' card, to the letter: the two lists are one page, and a device
    // that sat in a differently-drawn box would read as a different kind of thing.
    <HStack
      asChild
      p="3"
      gap="3"
      rounded="md"
      borderWidth="1px"
      borderColor="border.emphasized"
      cursor="pointer"
      _hover={{bg: 'bg.emphasized'}}
    >
      <Link to="/crew/noise/device/$device" params={{device: device.id}}>
        {/* Name, charge and stage in one strip, in that order — the same arrangement the
            device page's own toolbar puts them in (see DeviceStatusLine), so a monitor
            reads the same way in the list as on its page. One line, so the rows of the
            list are one height: a monitor standing nowhere simply has no stage chip,
            rather than a line of type saying so. */}
        <HStack flex="1" minW="0" gap="2">
          {/* Lit or absent, never grey, as on the device page's title: the fact that a
              monitor is reporting belongs to its name rather than to any of the readings
              beside it, and where it isn't, the right of the row says since when — so
              there is nothing for a grey light to add. */}
          {alive && (
            <LiveStatusDot
              lastSeen={seen}
              ble={device.id === bluetooth.deviceName}
            />
          )}
          {/* What gives when the row runs out of width: the chips after it are facts of
              fixed length, and the name is the one thing an ellipsis still identifies. */}
          <Text fontWeight="bold" truncate minW="0">
            {device.id}
          </Text>
          {/* Only while it is reporting: the voltage rides on the live record and nothing
              stores it, so an old one shown as current would be a charge the monitor had
              twenty minutes ago. */}
          {alive && batteryMv != null && <BatteryChip mv={batteryMv} />}
          {/* The section's place chip, pin included — the same object the device page's
              toolbar and a project's roster show, so a stage is one kind of thing
              wherever it appears. Not pressable and not a link, unlike that toolbar's:
              this whole row is already an anchor, and one inside another is not markup a
              browser will keep. Pressing it goes to the device, which is where a list of
              devices should lead. */}
          {device.assignment && (
            <Chip flexShrink="0" maxW="40" minW="0">
              {/* currentColor, and never shrinks: the location's name is what gives. */}
              <Box asChild flexShrink="0">
                <LuMapPin />
              </Box>
              <Span truncate minW="0">
                {device.assignment.locationName}
              </Span>
            </Chip>
          )}
        </HStack>
        <HStack gap="2" flexShrink="0">
          {level.kind !== 'none' && (
            // Muted once it is only the last thing this monitor said, so a number that
            // has stopped moving doesn't keep reading as one that hasn't.
            <Text
              whiteSpace="nowrap"
              color={level.kind === 'stale' ? 'fg.subtle' : undefined}
            >
              {formatDb(
                level.db,
                `${weightingUnit('A')} ${metricTag('eq_fast', true)}`,
              )}
            </Text>
          )}
          {/* Where the light at the front isn't: since when we haven't heard from it,
              which is what separates one somebody just unplugged from one that has been
              down since yesterday. */}
          {now != null && !alive && (
            <Span fontSize="xs" color="fg.muted" whiteSpace="nowrap">
              {formatSeen(seen, now)}
            </Span>
          )}
        </HStack>
        <Span color="fg.subtle">
          <FaChevronRight />
        </Span>
      </Link>
    </HStack>
  );
}
