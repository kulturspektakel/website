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
import {type BluetoothSlice} from './context';
import {toaster} from '../chakra-snippets/toaster';

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
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
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
      toaster.create({type: 'success', title: 'Kalibrierung gespeichert'});
      onClose();
    } catch (e) {
      toaster.create({
        type: 'error',
        title: 'Kalibrierung fehlgeschlagen',
        description: e instanceof Error ? e.message : String(e),
      });
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

  return (
    <FloatingPanel.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      defaultSize={{width: 360, height: 460}}
      minSize={{width: 300, height: 220}}
    >
      <Portal>
        <FloatingPanel.Positioner>
          <FloatingPanel.Content>
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
                    <Text color="red.500" fontSize="sm">
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
                      <Box
                        minW="16"
                        fontFamily="mono"
                        flexShrink="0"
                        textAlign="end"
                      >
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
                        color="gray.500"
                        fontFamily="mono"
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
                Zurücksetzen
              </Button>
              <Button size="sm" onClick={apply} loading={saving} disabled={!dirty}>
                Speichern
              </Button>
            </HStack>
            <FloatingPanel.ResizeTriggers />
          </FloatingPanel.Content>
        </FloatingPanel.Positioner>
      </Portal>
    </FloatingPanel.Root>
  );
}
