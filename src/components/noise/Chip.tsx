import {Badge, type BadgeProps} from '@chakra-ui/react';

// The three looks a chip has, in the one place that knows their shades — what it is filled
// with, what its text is, and how it answers the pointer:
//
//   plain  a label, filled. A monitor's name, its cell voltage, the stage it is standing at.
//          Filled at the step the hover state used to be: a chip is a small solid object,
//          and the tinted-and-ringed version read as an outline somebody had drawn round
//          some text.
//   off    one of a set you toggle, and off. The same chip with the fill taken out: an
//          outline and muted text, so a roster reads as the places you are *not* watching
//          being the quiet ones rather than as ten equal boxes. Hovering fills it in, which
//          is a preview of what pressing does.
//   on     lit. The palette's own solid with the text colour it guarantees contrast against
//          — the pairing every filled control in the system uses, so a lit chip and a
//          primary button are the same shade of "on". Its hover is that fill at 90 %, which
//          is that system's answer too: a lit thing acknowledges the pointer by settling
//          rather than by brightening, and it cannot brighten anyway.
//
// The raw palette steps (600) are there because the semantic surface tokens stop at
// `emphasized`: this section renders dark throughout, where 600 is the step above it. In a
// light theme that number would be a step *down*, which is the one thing to know before
// reusing this outside /crew.
const LOOKS = {
  plain: {
    bg: 'colorPalette.emphasized',
    hover: {bg: 'colorPalette.600', color: 'white'},
  },
  off: {
    // The outline in the filled chips' own shade, so an off chip reads as one of them with
    // nothing in it rather than as a different kind of thing.
    shadowColor: 'colorPalette.emphasized',
    color: 'fg.muted',
    hover: {bg: 'colorPalette.emphasized', color: 'white'},
  },
  on: {
    bg: 'colorPalette.solid',
    color: 'colorPalette.contrast',
    hover: {bg: 'colorPalette.solid/90'},
  },
} as const;

// The section's small labels, in one look: a monitor's name, its cell voltage, the stage it
// is standing at, the count of the names a line had no room for, every place on a project's
// roster. They sit beside each other in a toolbar and under each other on a card, so what
// they must not do is each be a slightly different box — which is what they were, one
// hand-rolled and one a Badge.
export function Chip({
  pressable,
  selected,
  ...rest
}: BadgeProps & {
  // Whether this one does something when pressed. The caller supplies the link or the
  // button (`asChild`), because only the caller knows what.
  pressable?: boolean;
  // Whether it is *on* — and, when absent, that it is not the kind of chip that has an on.
  // Three states rather than two, because "a label" and "a toggle that is off" are not the
  // same thing to look at: the first is the only chip there, the second is one of a set with
  // its neighbours lit (see LocationPicker).
  //
  // Which palette it lights up in is the caller's: what "on" *means* differs per roster, and
  // the shades of the three states are the only part that shouldn't.
  selected?: boolean;
}) {
  const {hover, ...look} =
    LOOKS[selected == null ? 'plain' : selected ? 'on' : 'off'];
  return (
    <Badge
      // `outline` is the one look with no fill, and Chakra's own — so the ring is drawn the
      // way every outlined thing in the system draws one rather than by a shadow of ours.
      variant={selected === false ? 'outline' : 'subtle'}
      colorPalette="gray"
      {...look}
      {...(pressable && {cursor: 'pointer', _hover: hover})}
      {...rest}
    />
  );
}
