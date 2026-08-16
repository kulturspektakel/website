import {useEffect, useState} from 'react';
import {Input} from '@chakra-ui/react';
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
// bound means the edge of the event, so a row that holds throughout is two blank fields.
//
// Its own module because both editors behind a location's ⋮ are tables of exactly this
// pair — a placement's window and a limit's — and the blur/clear rule below is the sort
// of detail that would be right in one copy and quietly wrong in the other.
//
// It reports the cleared field on blur rather than on change, unlike the dB field beside
// it, because '' is ambiguous here: mid-edit and emptied look the same, and only one of
// them means the edge of the event.
export function TimeField({
  label,
  value,
  window,
  onChange,
}: {
  // Not rendered: the column heading says which end this is, and the row says what it
  // is the end of, but neither is attached to the input for anyone not reading the table.
  label: string;
  value: number | null;
  window: {start: number; end: number};
  onChange: (value: number | null) => void;
}) {
  const {draft, setDraft, revert} = useDraftField(value, toLocalInput);

  return (
    <Input
      type="datetime-local"
      aria-label={label}
      size="sm"
      minW="52"
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
        if (draft === '') {
          onChange(null);
          return;
        }
        // Never leave a value on screen that isn't the one in effect: a draft that
        // never parsed is abandoned rather than guessed at.
        if (!fromLocalInput(draft)) revert();
      }}
    />
  );
}
