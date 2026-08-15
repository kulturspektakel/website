import {useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {IconButton} from '@chakra-ui/react';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {toaster} from '../chakra-snippets/toaster';
import {errorToast} from './toast';
import {CalibrationPanel} from './CalibrationPanel';
import {WifiDialog} from './WifiDialog';
import {useBluetooth, useNoiseLive} from './context';
import {useDeviceView} from './deviceView';
import {decodeDb, isFresh} from './noise';
import {BAND_FREQUENCIES} from './bluetooth';

// Everything you can *do* to a monitor, behind the one ⋮ at the end of its toolbar: pair
// with it over Bluetooth and then calibrate it or set up its WLAN, and the one thing that
// belongs to the band chart rather than to the page.
//
// Where it stands is not among them any more: that is a placement at an event, made in the
// project page's assignments dialog, and the free-text label this used to write was a
// second answer to the same question that no reading was ever filed under.
//
// What the page is *showing* is not in here — the weighting and the window are the
// toolbar's two dropdowns, beside this button. The menu used to carry them as
// submenus, and a timeframe item besides, from when this page had a historical view and
// no toolbar to put a picker in.
export function DeviceMenu({device}: {device: string}) {
  // The store rather than a subscription: the one thing here that reads a record does
  // it inside a click handler (see copyBands), so nothing about this menu changes when
  // one arrives.
  const live = useNoiseLive();
  const bluetooth = useBluetooth();
  const {referenceMic} = useDeviceView();
  const navigate = useNavigate();
  const [calibrating, setCalibrating] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);

  const bleConnected = bluetooth.deviceName != null;

  // Pairing lands you on the paired monitor's page: whichever device you have just
  // picked out of the browser's chooser is the one you meant to be looking at.
  const connectBle = async () => {
    const name = await bluetooth.connect();
    if (name) {
      void navigate({
        to: '/crew/lautstaerke/device/$device',
        params: {device: name},
      });
    }
  };

  // Copy the live per-band spectrum as TSV (Hz<tab>dB, one band per line) so it
  // pastes straight into a spreadsheet. Live-only: reads the current record off
  // the shared context, aligned with the fixed 1/3-octave band centers.
  const copyBands = async () => {
    const deviceState = live.get(device);
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
            loading={bluetooth.connecting}
          >
            <LuEllipsisVertical />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          {/* The two items that belong to the band chart rather than to the monitor: a
              second spectrum to draw over it, and the one it is already drawing as numbers.
              The second is unconditional — this page has one view and that view has that
              chart. The first is dropped rather than disabled where the browser cannot
              capture at all, there being nothing behind it and nothing to go and enable. */}
          {referenceMic.supported && (
            <MenuItem
              value="reference-mic"
              onClick={() => {
                void referenceMic.open();
              }}
            >
              Referenzmikrofon…
            </MenuItem>
          )}
          <MenuItem
            value="copy-bands"
            onClick={() => {
              void copyBands();
            }}
          >
            Frequenzbänder kopieren
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
                color="fg.error"
                _hover={{bg: 'bg.error', color: 'red.fg'}}
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
