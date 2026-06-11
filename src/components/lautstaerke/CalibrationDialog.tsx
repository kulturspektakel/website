import {useCallback, useEffect, useState} from 'react';
import {Box, Button, Center, HStack, Spinner, Stack, Text} from '@chakra-ui/react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
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

export function CalibrationDialog({
  open,
  onClose,
  bluetooth,
  deviceName,
}: {
  open: boolean;
  onClose: () => void;
  bluetooth: BluetoothSlice;
  deviceName: string;
}) {
  const [offsets, setOffsets] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {readCalibration, writeCalibration} = bluetooth;

  // Read the device's stored trims each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOffsets(null);
    readCalibration()
      .then((values) => {
        if (!cancelled) setOffsets(values);
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

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
      scrollBehavior="inside"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kalibrierung – {deviceName}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
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
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={reset}
            disabled={!offsets || saving}
          >
            Zurücksetzen
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={apply} loading={saving} disabled={!offsets}>
            Anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
