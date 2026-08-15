import {useNavigate} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {Box, Button, HStack, Span} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';
import {
  MenuContent,
  MenuRadioItem,
  MenuRadioItemGroup,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {noiseMonitorDevices} from '../../routes/crew.lautstaerke';
import {
  useBluetooth,
  useDeviceState,
  useDeviceStates,
  useTick,
} from './context';
import {compareDeviceIds, formatLastSeen, isFresh, lastSeenAt} from './noise';
import {LiveStatusDot} from './LiveStatusDot';
import {noiseQueryKeys} from './queries';

// Which monitor the device page is showing, as the page's own title — the name is the
// heading and the heading is the way to the next one, because "look at that one instead"
// is the only navigation this page has, and a list to go back to first is a list nobody
// wanted to see.
//
// A menu rather than a select, because the rows say more than their names: which monitors
// are reporting right now, and for the ones that aren't, since when. That is the question
// you are actually asking when you open this — which is why the answer is in the list
// rather than one page away.
export function DevicePicker({device}: {device: string}) {
  // This monitor's own state, for the light on the button. Read here rather than passed in
  // because the route must not subscribe — a record arriving would wake the whole toolbar
  // (see DeviceStatusLine, which reads the same device for the chips beside this).
  const state = useDeviceState(device);
  const bluetooth = useBluetooth();
  const now = useTick();
  const alive = isFresh(state?.lastSeen, now);

  return (
    // Mounted only while open, so the subscription to every monitor's records below —
    // and its clock — exist only while somebody is reading them. A page about one
    // instrument must not listen to all of them for the sake of a closed menu.
    <MenuRoot lazyMount unmountOnExit>
      <MenuTrigger asChild>
        {/* As wide as the name and no wider, down to whatever the strip has left: the
            title is a name, so it takes a name's width rather than a column's, and gives
            that up to an ellipsis before the controls beside it give up anything. Ghost,
            because it is the page's heading first and a control second — the chevron is
            what says it can be pressed. */}
        <Button
          variant="ghost"
          size="sm"
          px="2"
          gap="1"
          minW="0"
          maxW="full"
          fontSize="md"
          fontWeight="bold"
        >
          {/* Lit or absent, never grey: on the button there is nothing for a grey dot to
              be read against, so "no light" is the whole of what it would have said. The
              list is where the two states sit side by side and a slot has to be kept. */}
          {alive && (
            <LiveStatusDot
              lastSeen={state?.lastSeen}
              ble={device === bluetooth.deviceName}
            />
          )}
          <Span truncate minW="0">
            {device}
          </Span>
          <Box asChild flexShrink="0" color="fg.muted">
            <LuChevronDown />
          </Box>
        </Button>
      </MenuTrigger>
      <MenuContent minW="56">
        <DeviceOptions device={device} />
      </MenuContent>
    </MenuRoot>
  );
}

// Every monitor there is, not just the ones reporting: the reason to open a monitor's page
// is often that it has gone quiet, and a list that dropped those would hide exactly the
// device you were looking for. The set is cached under the section's own key, which nothing
// invalidates — it changes when a new monitor first reports in — so opening the menu twice
// costs one read.
//
// Its own component because of the hooks: they belong to the open menu (see lazyMount
// above), and a page that is about one device has no business subscribing to the records of
// all of them, or ticking once a second, while nobody is choosing.
function DeviceOptions({device}: {device: string}) {
  const navigate = useNavigate();
  const {data: devices} = useQuery({
    queryKey: noiseQueryKeys.monitorDevices,
    queryFn: () => noiseMonitorDevices(),
  });

  // By name, and the device on screen is always in the list — whether or not the query has
  // answered, and whether or not the table has it. A menu whose current value is missing
  // reads as a page about nothing.
  const rows = useMemo(() => {
    const known = devices ?? [];
    const all = known.some((d) => d.id === device)
      ? known
      : [...known, {id: device, lastSeen: null}];
    return [...all].sort((a, b) => compareDeviceIds(a.id, b.id));
  }, [devices, device]);

  // One subscription for the whole list rather than one per row, which is what this hook
  // is for — the rows are read together and a record for any of them changes one dot.
  const state = useDeviceStates(rows.map((d) => d.id));
  const bluetooth = useBluetooth();
  const now = useTick();

  return (
    <MenuRadioItemGroup
      value={device}
      // The whole page follows, so this is a navigation and not a filter: the URL is where
      // "which monitor" lives, which is what makes one linkable.
      onValueChange={(e) =>
        void navigate({
          to: '/crew/lautstaerke/device/$device',
          params: {device: e.value},
        })
      }
    >
      {rows.map(({id, lastSeen}) => {
        // The record and the live store, merged by the one rule for it: the table is all
        // we know about a monitor that went quiet before this tab connected, and the store
        // is all we know about one that has reported since.
        const seen = lastSeenAt(lastSeen, state(id)?.lastSeen);
        const alive = isFresh(seen, now);
        return (
          // Chakra's own selected state — a check in the left padding, and the radio role
          // and aria-checked that go with it, which is more than a tick of our own drawing
          // would have said. Its text slot is a div, so the row below may be one.
          <MenuRadioItem key={id} value={id}>
            <HStack gap="2" minW="0" w="full">
              <Span truncate minW="0">
                {id}
              </Span>
              {/* One slot at the far right, holding whichever of the two answers this
                  monitor has to the same question. A light means it is reporting now;
                  otherwise, since when it hasn't been — which is what separates one
                  somebody just unplugged from one that has been down since yesterday.
                  They cannot both apply, so the names keep their column either way and
                  the state is read down a second one. */}
              <Box
                ms="auto"
                ps="2"
                flexShrink="0"
                display="flex"
                alignItems="center"
              >
                {alive ? (
                  <LiveStatusDot
                    lastSeen={seen}
                    ble={id === bluetooth.deviceName}
                  />
                ) : (
                  <Span fontSize="xs" color="fg.muted">
                    {seen != null ? formatLastSeen(seen, now) : 'nie gesehen'}
                  </Span>
                )}
              </Box>
            </HStack>
          </MenuRadioItem>
        );
      })}
    </MenuRadioItemGroup>
  );
}
