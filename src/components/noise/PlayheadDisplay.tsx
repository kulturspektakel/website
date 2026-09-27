import {
  AbsoluteCenter,
  Box,
  Button,
  HStack,
  Span,
  Spinner,
  Text,
} from '@chakra-ui/react';
import {memo, useCallback, useState} from 'react';
import {dayOf, hourMinuteOf, weekdayOf, zonedDate} from './chartUtils';
import {useTick} from './context';
import {usePlayheadEffect} from './projectView';

// What the clock reads when there is no instant to read: shaped like one, so the panel
// holds its width and the name under it doesn't jump the moment something is pointed at.
// The pins' placeholder, for the same reason (see NO_LEVEL_LABEL).
const NO_TIME = {weekday: '--', date: '--.--.', time: '--:--:--'};

// The words the charts' tooltips print for an instant (see instantLabel), in its two halves
// so the day can give way on a phone while the time stays. To the second whichever mode the
// page is in — a timecode keeps its seconds even while they read :00, which scrubbing always
// does (the playhead lands on the minute, as the stored readings do), so the panel is the
// same width live and scrubbed.
function clockParts(ms: number): {weekday: string; date: string; time: string} {
  const d = zonedDate(ms / 1000);
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return {
    weekday: weekdayOf(d),
    date: dayOf(d),
    time: `${hourMinuteOf(d)}:${seconds}`,
  };
}

// Every weekday's name, in the locale the clock prints them in: seven consecutive days from
// any instant are one of each. Read once, for the slot below.
const WEEKDAYS = Array.from({length: 7}, (_, i) =>
  weekdayOf(zonedDate(i * 24 * 60 * 60)),
);

/**
 * The page's heading and its mode, in one: the instant being read, as the readout an
 * editing app keeps over its timeline — a recessed panel with the timecode in it and what
 * is playing named under it — and, at its right edge, the LIVE key that decides whether that
 * instant is now or one picked on the strip. Where the project's name used to be the whole of
 * the title, because on a page about one festival the question the header is asked is "when
 * am I looking at", and the name is the answer to a question already settled by arriving
 * here. The switch that used to sit at the other end of the toolbar is this key now: the
 * clock and what it is set to are one statement, and the key lit green is also the whole of
 * how the panel says it is live.
 *
 * Its own component and memoized, because what it shows moves on every frame of a hover
 * while nothing else in the header does: it follows the playhead off its signal (see
 * usePlayheadEffect) and so is the one thing that re-renders for it. A minute at a time,
 * since that is all the stored readings resolve and all the clock here prints.
 *
 * As tall as the dropdowns beside it and no taller, so arriving with it did not make the
 * toolbar any taller: a 13px line over a 10px one, set tight, fits inside with room to spare.
 */
export const PlayheadDisplay = memo(function PlayheadDisplay({
  name,
  live,
  onLiveChange,
  pending,
}: {
  // What is playing: the project.
  name: string;
  live: boolean;
  // A state setter, so the memo holds.
  onLiveChange: (live: boolean) => void;
  // The project's whole history on its way, on the first press out of live — the one moment
  // this page waits for anything.
  pending: boolean;
}) {
  const [playhead, setPlayhead] = useState<number | null>(null);
  usePlayheadEffect(
    useCallback(
      (at: number | null) =>
        setPlayhead(at == null ? null : Math.floor(at / 60_000) * 60_000),
      [],
    ),
  );

  return (
    <HStack
      // Framed and not filled: the toolbar's own ground inside the same rule the dropdowns
      // beside it are drawn in (an outline field's `border`), so the strip's boxes are one
      // kind of box.
      borderWidth="1px"
      borderColor="border"
      rounded="l2"
      // The height of the dropdowns beside it (an `xs` select's field, border included),
      // so the strip's boxes stand one height; the two lines and the key are centred in it.
      h="8"
      align="center"
      ps="2.5"
      pe="1"
      gap="2.5"
      minW="0"
      maxW="full"
    >
      <Box minW="0" flex="1">
        {live ? (
          <LiveClock />
        ) : (
          <Clock {...(playhead == null ? NO_TIME : clockParts(playhead))} />
        )}
        {/* Still the page's h1, set small: it is what the page is about, even where it is
            no longer what the header leads with. */}
        <Text as="h1" fontSize="2xs" color="fg.muted" truncate lineHeight="1.1">
          {name}
        </Text>
      </Box>
      {/* After the clock it sets, at the end nearer the controls, where the switch it
          replaced used to stand. */}
      <LiveKey live={live} onChange={onLiveChange} pending={pending} />
    </HStack>
  );
});

// The mode, as a key on the display rather than a switch beside it — in the form a stream
// player gives the same key: a dot and the word, no fill and no frame, green while the page
// is at the live edge and grey when it is behind it. Off then reads as "not live, and this is
// how to get back", which is exactly what it is, rather than as a lighter shade of on or a
// control that has been disabled. The green is the one the section means "reporting now" by
// (see LiveStatusDot). Off brightens under the pointer, which is what says the grey word is
// something to press. A toggle button, so it says which it is — pressed or not — to anyone
// not reading its colour.
//
// While the history loads, a spinner stands in for the word, over it rather than instead of
// it: the word goes on laying the key out at its own width, so nothing beside it shuffles
// along and back. `visibility` and not `opacity`, which would leave text that is invisible
// and still read out. Muted rather than green, which is what the key says when live is *on*
// — a green spinner would read as the state instead of as the wait for one.
function LiveKey({
  live,
  onChange,
  pending,
}: {
  live: boolean;
  onChange: (live: boolean) => void;
  pending: boolean;
}) {
  return (
    <Button
      size="2xs"
      variant="ghost"
      flexShrink="0"
      position="relative"
      aria-pressed={live}
      disabled={pending}
      cursor={pending ? 'progress' : undefined}
      color={live ? 'green.fg' : 'fg.muted'}
      _hover={{color: live ? 'green.fg' : 'fg'}}
      fontWeight="bold"
      letterSpacing="wide"
      onClick={() => onChange(!live)}
    >
      <HStack gap="1.5" visibility={pending ? 'hidden' : undefined}>
        {/* The lamp: the status dot's solid green while live — the word's `green.fg` is a
            text shade and washes out as a dot (see LiveStatusDot) — and the word's own grey
            when not. */}
        <Box
          w="2"
          h="2"
          rounded="full"
          bg={live ? 'green.solid' : 'currentColor'}
          flexShrink="0"
        />
        LIVE
      </HStack>
      {pending && (
        <AbsoluteCenter>
          <Spinner size="xs" color="fg.muted" />
        </AbsoluteCenter>
      )}
    </Button>
  );
}

function Clock({
  weekday,
  date,
  time,
}: {
  weekday: string;
  date: string;
  time: string;
}) {
  return (
    <Text
      // Between the theme's xs and sm, which is a step too far either way for a line that
      // is both the header's lead and one of two in a strip's height.
      fontSize="13px"
      fontWeight="bold"
      lineHeight="1.1"
      // Tabular, so a playhead carried across the evening doesn't shake the panel a
      // digit's width at a time.
      fontVariantNumeric="tabular-nums"
      whiteSpace="nowrap"
    >
      {/* The day gives way on a phone, where the strip is short of room: the time is what
          is read, and the day is the one every minute of an evening shares. */}
      <Span hideBelow="sm">
        <Weekday>{weekday}</Weekday> {date}{' '}
      </Span>
      {time}
    </Text>
  );
}

// Its own component, so the second-by-second tick is only subscribed while live.
function LiveClock() {
  return <Clock {...clockParts(useTick(1000))} />;
}

// The weekday, in a slot as wide as the widest of the seven. Tabular figures fix the digits
// but not the letters, so "Mi." and "Fr." would move everything after them as the playhead
// crosses midnight. Every name is stacked in the same grid cell, the others hidden, which
// makes the cell the widest of them in whatever font and locale this renders in, with no
// width written down that a different typeface would get wrong. Hidden by `visibility`, so
// they take their room and nothing else: not read out, not selectable.
function Weekday({children}: {children: string}) {
  return (
    <Span display="inline-grid" textAlign="start">
      {WEEKDAYS.map((name) => (
        <Span
          key={name}
          gridArea="1 / 1"
          visibility={name === children ? undefined : 'hidden'}
          aria-hidden={name === children ? undefined : true}
        >
          {name}
        </Span>
      ))}
      {/* The placeholder, which is none of the seven. */}
      {!WEEKDAYS.includes(children) && <Span gridArea="1 / 1">{children}</Span>}
    </Span>
  );
}
