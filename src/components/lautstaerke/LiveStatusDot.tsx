import {Box} from '@chakra-ui/react';
import {useTick} from './context';
import {isFresh} from './noise';

// Online dot, shared by the device header and every device row. Ticks internally
// so only it (not its parent) re-renders each second. Driven by live MQTT state,
// which is "is the device alive now" — independent of which day is being viewed,
// so it shows on every view. Turns blue while this device is the one connected
// over Bluetooth.
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
      w="3"
      h="3"
      rounded="full"
      flexShrink="0"
      bg={ble ? 'blue.500' : isFresh(lastSeen, now) ? 'green.500' : 'gray.400'}
    />
  );
}
