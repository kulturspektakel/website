import {useEffect, useRef} from 'react';
import {CAL_BAND_COUNT, CAL_MAX_DB, CAL_STEP_DB} from './bluetooth';
import {toaster} from '../chakra-snippets/toaster';

// Carrying a set of trims from one device to another, over the clipboard. The
// wire format is just the 31 values, one per line ("1.0\n-2.5\n…").

export const formatCalibration = (offsets: number[]): string =>
  offsets.map((v) => v.toFixed(1)).join('\n');

export type ParsedCalibration =
  | {ok: true; offsets: number[]}
  | {ok: false; reason: string};

// Accepts the values separated by whitespace or commas, so a column pasted out
// of a spreadsheet and a comma-separated line both work.
export function parseCalibration(text: string): ParsedCalibration {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  const nums = parts.map(Number);
  if (parts.length !== CAL_BAND_COUNT || nums.some((n) => !Number.isFinite(n))) {
    return {
      ok: false,
      reason: `Erwartet ${CAL_BAND_COUNT} Zahlenwerte, ${parts.length} erhalten.`,
    };
  }
  // Snap to the slider's step and clamp to its range so the pasted values stay
  // valid (encodeCalibration would clamp anyway, but this keeps the UI
  // consistent).
  return {
    ok: true,
    offsets: nums.map((n) =>
      Math.max(
        -CAL_MAX_DB,
        Math.min(CAL_MAX_DB, Math.round(n / CAL_STEP_DB) * CAL_STEP_DB),
      ),
    ),
  };
}

// Active while the panel is open: a document-level ⌘/Ctrl+C·V handler (capture
// phase, so the panel's own key handling can't swallow it). Uses the async
// Clipboard API — a plain `copy` event never fires for a focused non-editable
// element without a selection.
export function useCalibrationClipboard({
  open,
  offsets,
  onPaste,
}: {
  open: boolean;
  offsets: number[] | null;
  onPaste: (offsets: number[]) => void;
}): void {
  // Read by the long-lived key handler, so it always copies what's on screen
  // without being re-registered on every slider nudge.
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  useEffect(() => {
    if (!open) return;

    const copy = () => {
      const current = offsetsRef.current;
      if (!current) return;
      navigator.clipboard.writeText(formatCalibration(current)).then(
        () => toaster.create({type: 'success', title: 'Kalibrierung kopiert'}),
        () => toaster.create({type: 'error', title: 'Kopieren fehlgeschlagen'}),
      );
    };

    const paste = (text: string) => {
      const parsed = parseCalibration(text);
      if (!parsed.ok) {
        toaster.create({
          type: 'error',
          title: 'Kalibrierung konnte nicht eingefügt werden',
          description: parsed.reason,
        });
        return;
      }
      onPasteRef.current(parsed.offsets);
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
}
