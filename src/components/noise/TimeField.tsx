import {useEffect, useState} from 'react';
import {Button, IconButton, Input} from '@chakra-ui/react';
import {LuX} from 'react-icons/lu';
import {InputGroup} from '../chakra-snippets/input-group';
import {fromLocalInput, toLocalInput} from './timeframe';

/**
 * A text field's own copy of what is in it while it is being edited.
 *
 * Every field in the two editors behind a location's ⋮ needs one: what is in an input
 * mid-edit — '9', '92.', a half-filled datetime-local, which reports '' — is not yet a
 * value, and a field driven straight off the committed one would fight the keystrokes or
 * snap back between them.
 *
 * Shared rather than written per field because the third line is the one that gets
 * forgotten: `revert` is what a blur over a draft that never parsed calls, so the screen
 * never shows a value that isn't the one in effect. What each field does *with* it still
 * differs — a blank time means the edge of the event and is reported on blur, a blank
 * number means the row isn't finished and is reported on change — and that stays at the
 * call sites, because it is the part that is genuinely not the same.
 */
export function useDraftField(
  value: number | null,
  format: (value: number) => string,
) {
  const text = value == null ? '' : format(value);
  const [draft, setDraft] = useState(text);
  // Keyed on the formatted string rather than the number, so a re-render that produces the
  // same text leaves a half-typed draft alone.
  useEffect(() => setDraft(text), [text]);
  return {draft, setDraft, revert: () => setDraft(text)};
}

// One end of a timeframe inside a project, which may legitimately be empty — an omitted
// bound means the edge of the event (or, for a placement's end, that the monitor is still
// standing), so a row that holds throughout is two empty fields.
//
// Empty is said rather than shown as a blank input: the field reads as what an empty bound
// *means* — "Project start", "Project end" — in the box an input would stand in, so it lines up with
// the dated rows around it and is plainly not a value someone forgot to fill. Pressing it sets
// the bound to the instant it stood for and opens the input on it, so pressing is choosing and
// the date is there to adjust. A dated bound carries a reset button that empties it again, which a
// datetime field has no gesture of its own for.
//
// Its own module because both editors behind a location's ⋮ are tables of exactly this
// pair — a placement's window and a limit's — and the blur/clear rule below is the sort
// of detail that would be right in one copy and quietly wrong in the other.
//
// It reports the cleared field on blur rather than on change, unlike the dB field beside
// it, because '' is ambiguous here: mid-edit and emptied look the same, and only one of
// them means the edge of the event.
// The least a field may be: wide enough for the browser's date and time, its picker icon, and
// the reset button inside the field's end (see TimeField). Shared by the empty bound's button,
// so the two kinds of row are one width.
const FIELD_MIN_W = '52';

export function TimeField({
  label,
  value,
  window,
  empty,
  onChange,
}: {
  // Not rendered: the column heading says which end this is, and the row says what it
  // is the end of, but neither is attached to the input for anyone not reading the table.
  label: string;
  value: number | null;
  window: {start: number; end: number};
  // What an empty bound means here — the words it shows, and the instant the input opens on
  // when it is pressed (the event's start or end; for an open end, the event's end). Absent
  // for a bound that may not be empty, which is then a plain input.
  empty?: {label: string; at: number};
  onChange: (value: number | null) => void;
}) {
  const {draft, setDraft, revert} = useDraftField(value, toLocalInput);
  // Whether the input has just replaced an empty bound's words, so it takes the focus.
  const [opened, setOpened] = useState(false);

  if (empty && value == null) {
    return (
      // The dated field's own width, so the two kinds of row end on one edge.
      <Button
        variant="outline"
        size="sm"
        minW={FIELD_MIN_W}
        w="full"
        justifyContent="flex-start"
        fontWeight="normal"
        color="fg.muted"
        aria-label={`${label}: ${empty.label}`}
        onClick={() => {
          onChange(empty.at);
          setOpened(true);
        }}
      >
        {empty.label}
      </Button>
    );
  }

  return (
    // The reset button inside the field's own border, at its end — part of the input rather
    // than a control beside it, which is what it acts on.
    <InputGroup
      w="full"
      minW={FIELD_MIN_W}
      endElementProps={{pe: '1'}}
      endElement={
        empty &&
        value != null && (
          <IconButton
            aria-label={`Reset ${label} to ${empty.label}`}
            size="2xs"
            variant="ghost"
            color="fg.muted"
            onClick={() => onChange(null)}
          >
            <LuX />
          </IconButton>
        )
      }
    >
      <Input
        type="datetime-local"
        aria-label={label}
        size="sm"
        autoFocus={opened}
        // Native bounds, so the picker offers the event rather than the century. Typed
        // input outside it is still accepted — a monitor may have been carried out
        // before the gates opened.
        min={toLocalInput(window.start)}
        max={toLocalInput(window.end)}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = fromLocalInput(e.target.value);
          if (parsed) onChange(parsed.getTime());
        }}
        onBlur={() => {
          setOpened(false);
          if (draft === '') {
            onChange(null);
            return;
          }
          // Never leave a value on screen that isn't the one in effect: a draft that
          // never parsed is abandoned rather than guessed at.
          if (!fromLocalInput(draft)) revert();
        }}
      />
    </InputGroup>
  );
}
