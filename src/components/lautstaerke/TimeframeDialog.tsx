import {useEffect, useState} from 'react';
import {Button, Input, Stack, Text} from '@chakra-ui/react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
import {Field} from '../chakra-snippets/field';
import {timeZone} from '../../utils/dateUtils';
import {
  END_BEFORE_START,
  MAX_RANGE_DAYS,
  MAX_RANGE_MS,
  defaultRange,
  fromLocalInput,
  toLocalInput,
} from './timeframe';

// Null when the pair is a usable timeframe, else the reason it isn't.
function rangeError(start: Date | null, end: Date | null): string | null {
  if (!start || !end) return 'Bitte Beginn und Ende angeben.';
  if (end.getTime() <= start.getTime()) {
    return END_BEFORE_START;
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    return `Der Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage umfassen.`;
  }
  return null;
}

// Picks the timeframe the history view queries. The fields are wall-clock in
// `timeZone` (see toLocalInput/fromLocalInput); what leaves here is a pair of UTC
// instants, which is what the URL and the query speak.
export function TimeframeDialog({
  open,
  onClose,
  onApply,
  current,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (range: {start: Date; end: Date}) => void;
  // The range in the URL, epoch ms, or null on the live view.
  current: {start: number; end: number} | null;
}) {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  // Seed from the current range each time the dialog opens, so it edits what
  // you're looking at; the live view has none, so offer the last hour.
  useEffect(() => {
    if (!open) return;
    const fallback = defaultRange(Date.now());
    const start = current?.start ?? fallback.start.getTime();
    const end = current?.end ?? fallback.end.getTime();
    setStartInput(toLocalInput(start));
    setEndInput(toLocalInput(end));
  }, [open, current]);

  const start = fromLocalInput(startInput);
  const end = fromLocalInput(endInput);
  const error = rangeError(start, end);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      {/* Light, though the area around it is dark — see DARK_ROUTE_ID in __root. */}
      <DialogContent appearance="light">
        <DialogHeader>
          <DialogTitle>Zeitraum</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap="4">
            <Field label="Beginn" required>
              <Input
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
              />
            </Field>
            <Field label="Ende" required>
              <Input
                type="datetime-local"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
              />
            </Field>
            <Text fontSize="sm" color={error ? 'red.400' : 'gray.500'}>
              {error ??
                `Zeiten in ${timeZone}. Höchstens ${MAX_RANGE_DAYS} Tage.`}
            </Text>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={start == null || end == null || error != null}
            onClick={() => {
              if (start == null || end == null || error != null) return;
              onApply({start, end});
              onClose();
            }}
          >
            Anzeigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
