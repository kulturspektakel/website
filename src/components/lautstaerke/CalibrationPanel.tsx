import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

  // Clipboard support so a set of trims can be carried to another device.
  // Active while the panel is open: a document-level ⌘/Ctrl+C·V handler (capture
  // phase, so the panel's own key handling can't swallow it). Uses the async
  // Clipboard API — a plain `copy` event never fires for a focused non-editable
  // element without a selection. The wire format is just the 31 values, one per
  // line ("1.0\n-2.5\n…").
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;

  useEffect(() => {
    if (!open) return;

    const copy = () => {
      const current = offsetsRef.current;
      if (!current) return;
      navigator.clipboard.writeText(current.map((v) => v.toFixed(1)).join('\n')).then(
        () => toaster.create({type: 'success', title: 'Kalibrierung kopiert'}),
        () =>
          toaster.create({type: 'error', title: 'Kopieren fehlgeschlagen'}),
      );
    };

    const paste = (text: string) => {
      const parts = text.trim().split(/[\s,]+/).filter(Boolean);
      const nums = parts.map(Number);
      if (parts.length !== CAL_BAND_COUNT || nums.some((n) => !Number.isFinite(n))) {
        toaster.create({
          type: 'error',
          title: 'Kalibrierung konnte nicht eingefügt werden',
          description: `Erwartet ${CAL_BAND_COUNT} Zahlenwerte, ${parts.length} erhalten.`,
        });
        return;
      }
      // Snap to the slider's step and clamp to its range so the pasted values
      // stay valid (encodeCalibration would clamp anyway, but this keeps the UI
      // consistent).
      setOffsets(
        nums.map((n) =>
          Math.max(
            -CAL_MAX_DB,
            Math.min(CAL_MAX_DB, Math.round(n / CAL_STEP_DB) * CAL_STEP_DB),
          ),
        ),
      );
      toaster.create({type: 'success', title: 'Kalibrierung eingefügt'});
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        copy();
      } else if (key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(paste, () =>
          toaster.create({type: 'error', title: 'Einfügen fehlgeschlagen'}),
        );
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

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
