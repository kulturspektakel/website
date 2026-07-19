import {useNavigate, useRouter} from '@tanstack/react-router';
import {useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {IconButton} from '@chakra-ui/react';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuRadioItem,
  MenuRadioItemGroup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  MenuTriggerItem,
} from '../chakra-snippets/menu';
import {crewAuth} from '../../server/crewAuth';
import {prismaClient} from '../../server/prismaClient.server';
import {toaster} from '../chakra-snippets/toaster';
import {locale} from '../../utils/dateUtils';
import {CalibrationPanel} from './CalibrationPanel';
import {WifiDialog} from './WifiDialog';
import {useLautstaerkeCtx} from './context';
import {useDeviceView} from './deviceView';

// yyyy-mm-dd → "Mo., 01.06.2026" (noon avoids any TZ date shift).
const dayLabelFmt = new Intl.DateTimeFormat(locale, {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const fmtDay = (date: string) =>
  dayLabelFmt.format(new Date(`${date}T12:00:00`));

// Records a new location for a device. DeviceLocation is history — each call
// appends a placement (latitude/longitude left null for now); resolveLocation
// picks the one in effect on the viewed day. id/createdAt have no DB default,
// so we set them here.
const setDeviceLocation = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({device: z.string(), locationName: z.string().trim().min(1)}),
  )
  .handler(async ({data}) => {
    await prismaClient.deviceLocation.create({
      data: {
        id: crypto.randomUUID(),
        deviceId: data.device,
        locationName: data.locationName,
        createdAt: new Date(),
      },
    });
  });

// The single header menu for a device view, consolidating what used to be four
// separate controls: Bluetooth (connect / calibrate / WLAN / disconnect),
// location, the live/history view picker, and the A/C weighting toggle.
export function DeviceMenu({
  device,
  currentLocation,
  days,
  dayValue,
}: {
  device: string;
  currentLocation?: string | null;
  days: string[];
  // 'live' on the live view, or the yyyy-mm-dd on a historical view.
  dayValue: string;
}) {
  const {bluetooth} = useLautstaerkeCtx();
  const {weighting, toggleWeighting, peaks, togglePeaks} = useDeviceView();
  const navigate = useNavigate();
  const router = useRouter();
  const [calibrating, setCalibrating] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const bleConnected = bluetooth.deviceName != null;
  // Keep the viewed day selectable even if it dropped off the recent-10 list
  // (e.g. reached directly by URL).
  const dayOptions =
    dayValue !== 'live' && !days.includes(dayValue) ? [dayValue, ...days] : days;

  const connectBle = async () => {
    const name = await bluetooth.connect();
    if (name) {
      void navigate({to: '/crew/lautstaerke/$device', params: {device: name}});
    }
  };

  const selectView = (value: string) => {
    if (value === 'live') {
      void navigate({to: '/crew/lautstaerke/$device', params: {device}});
    } else {
      void navigate({
        to: '/crew/lautstaerke/$device/$date',
        params: {device, date: value},
      });
    }
  };

  const editLocation = async () => {
    const input = window.prompt(
      'Standort für dieses Gerät festlegen:',
      currentLocation ?? '',
    );
    if (input == null) return; // cancelled
    const locationName = input.trim();
    if (!locationName || locationName === currentLocation) return;
    setSavingLocation(true);
    try {
      await setDeviceLocation({data: {device, locationName}});
      await router.invalidate();
      toaster.create({type: 'success', title: 'Standort gespeichert'});
    } catch (e) {
      toaster.create({
        type: 'error',
        title: 'Standort konnte nicht gespeichert werden',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton
            aria-label="Geräteoptionen"
            rounded="full"
            size="sm"
            flexShrink="0"
            variant="outline"
            loading={bluetooth.connecting || savingLocation}
          >
            <LuEllipsisVertical />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          {/* View: live or one of the recent days with data. */}
          <MenuRoot positioning={{placement: 'left-start', gutter: 2}}>
            <MenuTriggerItem value="view">
              Zeitraum: {dayValue === 'live' ? 'Live' : fmtDay(dayValue)}
            </MenuTriggerItem>
            <MenuContent>
              <MenuRadioItemGroup
                value={dayValue}
                onValueChange={(e) => selectView(e.value)}
              >
                <MenuRadioItem value="live">Live</MenuRadioItem>
                {dayOptions.map((d) => (
                  <MenuRadioItem key={d} value={d}>
                    {fmtDay(d)}
                  </MenuRadioItem>
                ))}
              </MenuRadioItemGroup>
            </MenuContent>
          </MenuRoot>

          {/* Frequency weighting (A/C). */}
          <MenuRoot positioning={{placement: 'left-start', gutter: 2}}>
            <MenuTriggerItem value="weighting">
              Frequenzbewertung: {weighting === 'A' ? 'dB(A)' : 'dB(C)'}
            </MenuTriggerItem>
            <MenuContent>
              <MenuRadioItemGroup
                value={weighting}
                onValueChange={(e) => {
                  if (e.value !== weighting) toggleWeighting();
                }}
              >
                <MenuRadioItem value="A">dB(A)</MenuRadioItem>
                <MenuRadioItem value="C">dB(C)</MenuRadioItem>
              </MenuRadioItemGroup>
            </MenuContent>
          </MenuRoot>

          {/* Peak-hold overlay on the live frequency chart. Only the live view
              has that chart, so the toggle is hidden on historical days. */}
          {dayValue === 'live' && (
            <MenuCheckboxItem
              value="peaks"
              checked={peaks}
              onCheckedChange={togglePeaks}
              closeOnSelect={false}
            >
              Peaks anzeigen
            </MenuCheckboxItem>
          )}

          <MenuSeparator />

          <MenuItem
            value="location"
            onClick={() => {
              void editLocation();
            }}
          >
            Standort festlegen…
          </MenuItem>

          <MenuSeparator />

          {/* Bluetooth: connect while disconnected, else calibrate/WLAN/trennen.
              The connect item always shows, but is disabled when the browser
              lacks Web Bluetooth support. Being connected implies support, so
              the calibrate/WLAN/disconnect branch needs no extra guard. */}
          {bleConnected ? (
            <>
              <MenuItem value="calibrate" onClick={() => setCalibrating(true)}>
                Kalibrieren
              </MenuItem>
              <MenuItem value="wifi" onClick={() => setWifiOpen(true)}>
                WLAN einrichten
              </MenuItem>
              <MenuItem
                value="disconnect"
                color="red.400"
                _hover={{bg: 'red.950', color: 'red.300'}}
                onClick={() => {
                  void bluetooth.disconnect();
                }}
              >
                Bluetooth trennen
              </MenuItem>
            </>
          ) : (
            <MenuItem
              value="connect"
              disabled={!bluetooth.supported}
              onClick={() => {
                void connectBle();
              }}
            >
              Bluetooth verbinden
            </MenuItem>
          )}
        </MenuContent>
      </MenuRoot>
      <CalibrationPanel
        open={calibrating}
        onClose={() => setCalibrating(false)}
        bluetooth={bluetooth}
      />
      {bluetooth.deviceName != null && (
        <WifiDialog
          open={wifiOpen}
          onClose={() => setWifiOpen(false)}
          bluetooth={bluetooth}
          deviceName={bluetooth.deviceName}
        />
      )}
    </>
  );
}
