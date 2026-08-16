import {Box} from '@chakra-ui/react';
import {useTick} from './context';
import {isFresh} from './noise';

// Online dot, shared by the device header and every device row. Ticks internally
// so only it (not its parent) re-renders each second. Driven by live MQTT state,
// which is "is the device alive now" — independent of which day is being viewed,
// so it shows on every view. Turns blue while this device is the one connected
// over Bluetooth.
//
// `green.solid` and not `fg.success`: this is a filled mark rather than type, and
// the foreground shade is a pale mint meant to carry small text on a dark ground —
// as 8 px of solid colour it reads washed out. Solid is also what the header's Live
// switch fills itself with, so the dot and the switch are the one green.
export function LiveStatusDot({
  lastSeen,
  ble,
}: {
  lastSeen?: number;
  ble: boolean;
}) {
  const now = useTick();
  return (
    <Box
      w="2"
      h="2"
      rounded="full"
      flexShrink="0"
      bg={
        ble ? 'blue.solid' : isFresh(lastSeen, now) ? 'green.solid' : 'fg.muted'
      }
    />
  );
}
