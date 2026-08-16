import {Icon} from '@chakra-ui/react';
import {LuWifi, LuWifiOff} from 'react-icons/lu';
import {type WifiStatus} from './bluetooth';

// Bare WiFi icon reflecting the connected device's wifi_status: green when
// connected, amber while connecting, and a struck-through grey icon when
// disconnected. Only meaningful for the BLE-connected device.
const CONFIG: Record<
  WifiStatus,
  {icon: typeof LuWifi; color: string; label: string}
> = {
  connected: {icon: LuWifi, color: 'green.solid', label: 'Wi-Fi connected'},
  connecting: {icon: LuWifi, color: 'fg.warning', label: 'Wi-Fi connecting'},
  disconnected: {
    icon: LuWifiOff,
    color: 'fg.subtle',
    label: 'Wi-Fi disconnected',
  },
};

export function WifiStatusIcon({status}: {status: WifiStatus}) {
  const {icon, color, label} = CONFIG[status];
  return (
    <Icon
      as={icon}
      color={color}
      boxSize="4"
      flexShrink="0"
      role="img"
      aria-label={label}
    />
  );
}
