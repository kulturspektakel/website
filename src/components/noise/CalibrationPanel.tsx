import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Box,
  Button,
  Center,
  FloatingPanel,
  HStack,
  Portal,
  Spinner,
  Stack,
  Text,
  Theme,
} from '@chakra-ui/react';
import {CloseButton} from '../chakra-snippets/close-button';
import {Slider} from '../chakra-snippets/slider';
import {
  BAND_FREQUENCIES,
  CAL_BAND_COUNT,
  CAL_MAX_DB,
  CAL_STEP_DB,
  formatBandFrequency,
} from './bluetooth';
import {type BluetoothSlice} from './noise';
import {toaster} from '../chakra-snippets/toaster';
import {errorMessage, errorToast} from './toast';
import {useCalibrationClipboard} from './useCalibrationClipboard';

// Calibration lives in a draggable, resizable floating panel rather than a
// modal dialog so the live frequency chart stays visible (and uncovered) while
// you trim each band.
export function CalibrationPanel({
  open,
  onClose,
  bluetooth,
}: {
  open: boolean;
  onClose: () => void;
  bluetooth: BluetoothSlice;
}) {
  const [offsets, setOffsets] = useState<number[] | null>(null);
  // The trims as read from the device, to detect unsaved changes.
  const [savedOffsets, setSavedOffsets] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {readCalibration, writeCalibration} = bluetooth;

  // Open a bit taller than before so more bands are visible at once, but never
  // taller than the viewport (leaving a small margin). Read once on first
  // render; the panel stays resizable from there.
  const defaultHeight = useMemo(
    () =>
      typeof window === 'undefined'
        ? 620
        : Math.min(620, window.innerHeight - 24),
    [],
  );

  // Read the device's stored trims each time the panel opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOffsets(null);
    setSavedOffsets(null);
    readCalibration()
      .then((values) => {
        if (!cancelled) {
          setOffsets(values);
          setSavedOffsets(values);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, readCalibration]);

  const setBand = useCallback((index: number, value: number) => {
    setOffsets((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      next[index] = value;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setOffsets(new Array(CAL_BAND_COUNT).fill(0));
  }, []);

  const apply = useCallback(async () => {
    if (!offsets) return;
    setSaving(true);
    setError(null);
    try {
      await writeCalibration(offsets);
      toaster.create({type: 'success', title: 'Calibration saved'});
      onClose();
    } catch (e) {
      errorToast('Calibration failed')(e);
    } finally {
      setSaving(false);
    }
  }, [offsets, writeCalibration, onClose]);

  // Only allow saving once the current trims differ from what's on the device.
  const dirty = useMemo(
    () =>
      offsets != null &&
      savedOffsets != null &&
      offsets.some((v, i) => v !== savedOffsets[i]),
    [offsets, savedOffsets],
  );

  // Clipboard support so a set of trims can be carried to another device.
  useCalibrationClipboard({open, offsets, onPaste: setOffsets});

  return (
    <FloatingPanel.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      defaultSize={{width: 360, height: defaultHeight}}
      minSize={{width: 300, height: 220}}
    >
      <Portal>
        {/* Dark, when every other portalled surface in the area is light: the live level
            and the trims are read against the chart.* vocabulary, which has no light
            half (see theme-noise and ReferenceMicPanel, which does the same). */}
        <Theme appearance="dark" hasBackground={false}>
          <FloatingPanel.Positioner>
            {/* Its own, because a portal hangs off <body> and so misses the layout's
                (see crew.noise). The live level in here ticks like any other. */}
            <FloatingPanel.Content fontVariantNumeric="tabular-nums">
              <FloatingPanel.Header>
                <FloatingPanel.DragTrigger>
                  <FloatingPanel.Title>Kalibrierung</FloatingPanel.Title>
                </FloatingPanel.DragTrigger>
                <FloatingPanel.Control>
                  <FloatingPanel.CloseTrigger asChild>
                    <CloseButton size="xs" />
                  </FloatingPanel.CloseTrigger>
                </FloatingPanel.Control>
              </FloatingPanel.Header>
              <FloatingPanel.Body overflowY="auto">
                {loading || !offsets ? (
                  <Center py="10">
                    {error ? (
                      <Text color="fg.error" fontSize="sm">
                        {error}
                      </Text>
                    ) : (
                      <Spinner size="lg" />
                    )}
                  </Center>
                ) : (
                  <Stack gap="4">
                    {BAND_FREQUENCIES.map((hz, i) => (
                      <HStack key={hz} gap="3">
                        <Box minW="16" flexShrink="0" textAlign="end">
                          {formatBandFrequency(hz)}
                        </Box>
                        <Slider
                          flex="1"
                          value={[offsets[i]!]}
                          min={-CAL_MAX_DB}
                          max={CAL_MAX_DB}
                          step={CAL_STEP_DB}
                          onValueChange={({value}) => setBand(i, value[0]!)}
                        />
                        <Text
                          color="fg.subtle"
                          fontSize="xs"
                          minW="14"
                          textAlign="end"
                          flexShrink="0"
                        >
                          {offsets[i]! > 0 ? '+' : ''}
                          {offsets[i]!.toFixed(1)} dB
                        </Text>
                      </HStack>
                    ))}
                  </Stack>
                )}
              </FloatingPanel.Body>
              <HStack
                justify="flex-end"
                gap="2"
                p="3"
                borderTopWidth="1px"
                flexShrink="0"
              >
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  disabled={!offsets || saving}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={apply}
                  loading={saving}
                  disabled={!dirty}
                >
                  Save
                </Button>
              </HStack>
              <FloatingPanel.ResizeTriggers />
            </FloatingPanel.Content>
          </FloatingPanel.Positioner>
        </Theme>
      </Portal>
    </FloatingPanel.Root>
  );
}
