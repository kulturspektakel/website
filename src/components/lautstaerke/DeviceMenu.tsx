import {useNavigate, useRouter, useSearch} from '@tanstack/react-router';
import {useMemo, useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {IconButton} from '@chakra-ui/react';
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
import {setDeviceLocation} from '../../routes/crew.lautstaerke';
import {toaster} from '../chakra-snippets/toaster';
import {errorToast} from './toast';
import {formatTimeframeRange, rangeSearch} from './timeframe';
import {CalibrationPanel} from './CalibrationPanel';
import {TimeframeDialog} from './TimeframeDialog';
import {WifiDialog} from './WifiDialog';
import {useBluetooth, useNoiseLive} from './context';
import {decodeDb, isFresh} from './noise';
import {useDeviceView} from './deviceView';
import {BAND_FREQUENCIES} from './bluetooth';

// The single header menu for a device view, consolidating what used to be four
// separate controls: Bluetooth (connect / calibrate / WLAN / disconnect),
// location, the live/history view picker, and the A/C weighting toggle.
export function DeviceMenu({
  device,
  currentLocation,
}: {
  device: string;
  currentLocation?: string | null;
}) {
  // This menu already navigates to the $device route, so it reads the viewed
  // timeframe from there rather than having it threaded down as a prop. Memoized
  // so TimeframeDialog's seed effect doesn't re-run on unrelated re-renders.
  const search = useSearch({from: '/crew/lautstaerke/$device'});
  const range = useMemo(
    () =>
      search.start && search.end
        ? {start: Date.parse(search.start), end: Date.parse(search.end)}
        : null,
    [search.start, search.end],
  );
  const ctx = useNoiseLive();
  const bluetooth = useBluetooth();
  const {weighting, toggleWeighting, peaks, togglePeaks} = useDeviceView();
  const navigate = useNavigate();
  const router = useRouter();
  const [calibrating, setCalibrating] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const bleConnected = bluetooth.deviceName != null;

  const connectBle = async () => {
    const name = await bluetooth.connect();
    if (name) {
      void navigate({to: '/crew/lautstaerke/$device', params: {device: name}});
    }
  };

  // The timeframe is a search param: an explicit UTC range shows history, no range
  // at all shows live.
  const setRange = (next: {start: Date; end: Date} | null) => {
    void navigate({
      to: '/crew/lautstaerke/$device',
      params: {device},
      search: next ? rangeSearch(next) : {},
    });
  };

  // Copy the live per-band spectrum as TSV (Hz<tab>dB, one band per line) so it
  // pastes straight into a spreadsheet. Live-only: reads the current record off
  // the shared context, aligned with the fixed 1/3-octave band centers.
  const copyBands = async () => {
    const deviceState = ctx.devices[device];
    if (!deviceState || !isFresh(deviceState.lastSeen, Date.now())) {
      toaster.create({type: 'error', title: 'Gerät ist nicht live'});
      return;
    }
    const tsv = Array.from(
      deviceState.latest.bands,
      (b, i) => `${BAND_FREQUENCIES[i]}\t${decodeDb(b).toFixed(1)}`,
    ).join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      toaster.create({type: 'success', title: 'Frequenzbänder kopiert'});
    } catch (e) {
      errorToast('Kopieren fehlgeschlagen')(e);
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
      errorToast('Standort konnte nicht gespeichert werden')(e);
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
          {/* View: live, or an arbitrary timeframe picked in the dialog. */}
          <MenuItem value="timeframe" onClick={() => setTimeframeOpen(true)}>
            Zeitraum:{' '}
            {range
              ? formatTimeframeRange(range.start, range.end)
              : 'Live'}
          </MenuItem>
          {range && (
            <MenuItem value="live" onClick={() => setRange(null)}>
              Live anzeigen
            </MenuItem>
          )}

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
          {range == null && (
            <>
              <MenuCheckboxItem
                value="peaks"
                checked={peaks}
                onCheckedChange={togglePeaks}
                closeOnSelect={false}
              >
                Peaks anzeigen
              </MenuCheckboxItem>
              <MenuItem
                value="copy-bands"
                onClick={() => {
                  void copyBands();
                }}
              >
                Frequenzbänder kopieren
              </MenuItem>
            </>
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
      <TimeframeDialog
        open={timeframeOpen}
        onClose={() => setTimeframeOpen(false)}
        onApply={setRange}
        current={range}
      />
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
