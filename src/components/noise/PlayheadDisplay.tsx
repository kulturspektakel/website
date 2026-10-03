import {Box, Span, Text, VisuallyHidden} from '@chakra-ui/react';
import {memo, useCallback, useState} from 'react';
import {dayOf, hourMinuteOf, weekdayOf, zonedDate} from './chartUtils';
import {useTick} from './context';
import {
  MenuContent,
  MenuRadioItem,
  MenuRadioItemGroup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {type TimePreset} from './timePresets';
import {ToolbarTitleButton} from './ToolbarTitleButton';
import {usePlayheadEffect} from './projectView';

// What the clock reads before it has been handed an instant — the one frame before the
// playhead's first value arrives: shaped like one, so the panel holds its width. The pins'
// placeholder, for the same reason (see NO_LEVEL_LABEL).
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

/**
 * The page's heading and its mode, in one: the instant being read, as the readout an
 * editing app keeps over its timeline — a recessed panel with the timecode in it — and, at
 * its right edge, the chevron of the menu the whole panel opens, which decides whether that
 * instant is now or one of a few windows worth looking at (see timePresets). Where the
 * project's name used to be the whole of the title, because on a page about one festival the
 * question the header is asked is "when am I looking at", and the name is the answer to a
 * question already settled by arriving here. The switch that used to sit at the other end of
 * the toolbar is this menu now: the clock and what it is set to are one statement.
 *
 * Memoized, and the playhead is subscribed to by the clock inside it rather than here (see
 * Clock): what it shows moves on every frame of a hover, and the menu around the clock has
 * nothing to redo for that.
 *
 * As tall as the dropdowns beside it and no taller, so arriving with it did not make the
 * toolbar any taller.
 */
export const PlayheadDisplay = memo(function PlayheadDisplay({
  name,
  withDate,
  live,
  presets,
  activePreset,
  onLive,
  onPreset,
  pending,
}: {
  // The project, which is still the page's heading — for a screen reader only, since on a
  // page about one festival the panel has no need to repeat which (see above).
  name: string;
  // Whether the clock needs the day at all: not for a project that fits inside one, where
  // no two instants share a clock time. The same question, asked of the same window, as the
  // timeline under it asks before it prints a date (see spanWithinDay) — so the two agree.
  withDate: boolean;
  live: boolean;
  // The windows the menu offers besides live (see timePresets), and the one the crop is on
  // right now, if any — so its row is ticked, and none is once the strip has been dragged
  // somewhere of its own. Memoized by the caller, both callbacks stable, so the memo holds.
  presets: readonly TimePreset[];
  activePreset: TimePreset | null;
  onLive: () => void;
  onPreset: (preset: TimePreset) => void;
  // The project's whole history on its way, on the first press out of live — the one moment
  // this page waits for anything.
  pending: boolean;
}) {
  return (
    <>
      {/* The page's heading, beside the panel rather than in it: the panel is a button,
          and a button may not hold one. */}
      <VisuallyHidden as="h1">{name}</VisuallyHidden>
      {/* The whole panel opens the menu of what the page reads: live, or one of the windows —
          picked from a list that names them all, so the state never has to be read off how
          lit a key is. Radio rows, since the page is in one of them; closes on the press.
          Mounted only while open, so the rows are not re-rendered with the panel. */}
      <MenuRoot positioning={{placement: 'bottom'}} lazyMount unmountOnExit>
        <MenuTrigger asChild>
          <ToolbarTitleButton
            // The window rather than the clock: the time changes every second while live,
            // which is no name for a control.
            aria-label={`Time: ${live ? 'Live' : (activePreset?.label ?? 'Custom')}`}
            // While the history loads (the first move out of live).
            pending={pending}
          >
            {/* The lamp, while the page is live and only then: the status dot's solid
                  green (see LiveStatusDot), pulsing, since it is what says the numbers are
                  arriving now. First, so it reads before the clock it qualifies. Always
                  mounted and folded to no width when not live, so it can open and close
                  rather than appear (see COLLAPSE). */}
            <Box
              w={live ? '2' : '0'}
              me={live ? '2' : '0'}
              h="2"
              rounded="full"
              bg="green.solid"
              flexShrink="0"
              animation={live ? 'pulse' : undefined}
              {...COLLAPSE}
            />
            <Clock live={live} withDate={withDate} />
          </ToolbarTitleButton>
        </MenuTrigger>
        <MenuContent>
          {/* Live, and then the windows — one radio group, since the page is in exactly one
              of them at a time (or in a crop of its own, which ticks none). */}
          <MenuRadioItemGroup
            value={live ? 'live' : (activePreset?.key ?? '')}
            onValueChange={({value}) => {
              if (value === 'live') return onLive();
              const preset = presets.find((p) => p.key === value);
              if (preset) onPreset(preset);
            }}
          >
            <MenuRadioItem value="live">Live</MenuRadioItem>
            {presets.length > 0 && <MenuSeparator />}
            {presets.map(({key, label}) => (
              <MenuRadioItem key={key} value={key}>
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioItemGroup>
        </MenuContent>
      </MenuRoot>
    </>
  );
});

// How the panel's parts open and close — the date, and the live lamp — which is how the
// panel itself resizes: a box sized by its contents cannot transition its own `width: auto`,
// but its contents can transition theirs, and the panel follows. Off for anyone who asked for
// less motion.
const COLLAPSE = {
  transitionProperty: 'min-width, max-width, width, margin, opacity',
  transitionDuration: 'moderate',
  transitionTimingFunction: 'ease-in-out',
  _motionReduce: {transition: 'none'},
} as const;

// The clock, one for both modes — so the date in it is the same element either side of the
// switch and can fold away rather than be swapped out. Live leaves the date off altogether:
// it is today, and the clock ticking is the instant. Only the time changes source: the
// second-by-second tick while live (see LiveTime), the playhead otherwise — subscribed to
// here, floored to the minute, so this and nothing around it re-renders as the playhead
// moves. A null from the signal is live's "no instant" and changes nothing: the last instant
// stays, which is what the date shows while it folds away.
function Clock({live, withDate}: {live: boolean; withDate: boolean}) {
  const [playhead, setPlayhead] = useState<number | null>(null);
  usePlayheadEffect(
    useCallback((at: number | null) => {
      if (at != null) setPlayhead(Math.floor(at / 60_000) * 60_000);
    }, []),
  );
  const {weekday, date, time} =
    playhead == null ? NO_TIME : clockParts(playhead);
  const showDate = withDate && !live;
  return (
    // In the title button's own type (see ToolbarTitleButton).
    <Text
      lineHeight="1.1"
      // Tabular, so a playhead carried across the evening doesn't shake the panel a
      // digit's width at a time.
      fontVariantNumeric="tabular-nums"
      whiteSpace="nowrap"
    >
      {/* The day gives way on a phone, where the strip is short of room: the time is what
          is read, and the day is the one every minute of an evening shares — which is also
          why it is the secondary grey and the time the full `fg`. */}
      {/* One run, weekday and date, in a box with a floor under its width and set flush
          right against the time. Tabular figures fix the digits but not the letters, so
          "Mi." and "Fr." are not the same width: the floor is what keeps the time from moving
          as the playhead crosses midnight, and the right edge is where any slack goes. In
          `ch`, the width of a digit, since the run is mostly digits.

          Always mounted, and folded to nothing rather than left out where there is no date
          to show — so it can close and open (see COLLAPSE). Folding means both width bounds
          and the word space after it (a margin, since a space character would be left
          standing between nothing and the time) go to zero; `max-width` is a cap above any
          date, which is what there is to transition towards. A flex box rather than an
          inline-block, whose baseline would drop to its bottom edge once it clips. */}
      <Span
        hideBelow="sm"
        display="inline-flex"
        justifyContent="flex-end"
        overflow="hidden"
        minW={showDate ? '8ch' : '0'}
        maxW={showDate ? '12ch' : '0'}
        me={showDate ? '0.3em' : '0'}
        opacity={showDate ? 1 : 0}
        color="fg.muted"
        aria-hidden={showDate ? undefined : true}
        {...COLLAPSE}
      >
        {weekday} {date}
      </Span>
      {live ? <LiveTime /> : time}
    </Text>
  );
}

// The time while live, its own component so the second-by-second tick is only subscribed
// then — and re-renders only this, not the clock around it.
function LiveTime() {
  return <>{clockParts(useTick(1000)).time}</>;
}
