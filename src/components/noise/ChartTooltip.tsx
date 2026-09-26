import {Box, HStack, Text} from '@chakra-ui/react';
import {Fragment, type ComponentProps, type ReactNode} from 'react';
import {HiMiniExclamationTriangle} from 'react-icons/hi2';

// What a chart readout looks like: a small dark pill that carries a value over a
// plot. Exported apart from the tooltip below because one readout on the project page
// isn't floating — the timeline's playhead label sits in the layout — and it names the
// very instant the row charts' tooltips do. Two looks for one number would read as two.
export const CHART_READOUT_STYLE = {
  bg: 'chart.readout.bg',
  borderWidth: '1px',
  borderColor: 'chart.rule',
  rounded: 'md',
  px: '2',
  py: '1',
  fontSize: 'xs',
  lineHeight: '1.2',
  whiteSpace: 'nowrap',
} as const;

// Where the pill sits above the point, and the one thing about it that depends on what is
// doing the pointing.
//
// A mouse wants only enough air for the pill to read as a label rather than as part of the
// trace. A finger is a hand over the very pixel being read, so on a touch screen the pill
// has to clear it — otherwise the readout opens underneath the thing that opened it, and a
// scrub is the one gesture where you cannot move the pointer aside to look without also
// moving what you are looking at. Roughly a fingertip's worth.
//
// A media query and not the pointer type of the event that opened it, which is what this
// first was: that meant a ref recording the last pointer kind, a `mousemove` listener to
// reset it, and a field on the tip carrying it to the render — a good deal of machinery, on
// a path that runs once an animation frame, to be right about a hybrid. `pointer: coarse`
// is wrong only there — an iPad driven from a trackpad gets a finger's clearance, a
// touchscreen laptop gets a mouse's — and being wrong costs a readout that floats a little
// far from its point or a little close to it. The same query the base theme already uses to
// stop iOS zooming into inputs (see theme.ts), so this is the section agreeing with the app
// about what a touch device is rather than inventing a second test.
//
// A custom property rather than two variants of the whole transform, because the transform
// also carries the horizontal placement below and the two are decided by different things.
const OFFSET_STYLE = {
  '--chart-tip-offset': '8px',
  '@media (pointer: coarse)': {'--chart-tip-offset': '44px'},
} as const;

// Floating readout anchored over a chart, positioned just above a point given in
// container-relative CSS pixels. The hosting container must be position: relative.
// Pointer-events are disabled so it never swallows cursor moves.
export function ChartTooltip({
  left,
  top,
  fraction,
  children,
}: {
  left: number;
  top: number;
  // How far along the container that point sits, 0…1 — what keeps the pill inside the box
  // (see below). Off cursorAnchor, which resolves it beside the two coordinates above.
  fraction: number;
  children: ReactNode;
}) {
  return (
    <Box
      position="absolute"
      pointerEvents="none"
      zIndex="1"
      css={OFFSET_STYLE}
      {...CHART_READOUT_STYLE}
      // Inline rather than style props: all three change per frame of a hover, and a style
      // prop would have Emotion hash a class for every pixel the pointer passes through.
      // The same reason the timeline's readout writes its transform inline.
      style={{
        left: `${left}px`,
        top: `${top}px`,
        // The pill starts at the point and is then pulled back by its own width in
        // proportion to how far along the chart that point is: centred in the middle
        // (-50%), flush right of it at the far left (0%), flush left of it at the far right
        // (-100%). That one expression is the clamping — a pill narrower than the chart
        // cannot leave it at any position, and unlike a hard clamp it never stops pointing
        // at the pixel it names.
        //
        // The same trick the timeline's thumb readout uses, and for the same reason it is
        // preferred over measuring: a percentage resolves against this element's own width,
        // so nothing has to read `offsetWidth` — which is the only way to know the width of
        // a pill whose contents are one reading on one card and five on another. That
        // measurement is what this used to do, in a layout effect on every hover frame.
        transform: `translate(-${fraction * 100}%, calc(-100% - var(--chart-tip-offset)))`,
      }}
    >
      {children}
    </Box>
  );
}

// One reading in a readout: what it is on the left, muted, and the number on the right in
// bold and in its line's colour — spread to the pill's full width so the numbers line up
// under each other rather than after names of different lengths. Shared by the trace's
// tooltip and the map's pins, which both list a location's monitors one per row.
//
// `dimmed` is a number that isn't a reading of the instant being looked at, `struck` one
// crew set aside — the same two looks the pins and the cards give those — and `over` one
// above a limit in force for its series: red, the colour the chart washes a breach in (see
// drawBreaches), with the warning sign ahead of it so the hue is not the only cue. A reading
// set aside is never over — nobody is counting it — so struck wins.
export function ChartTooltipRow({
  label,
  value,
  color,
  dimmed = false,
  struck = false,
  over = false,
}: {
  label: string;
  value: string;
  color?: string;
  dimmed?: boolean;
  struck?: boolean;
  over?: boolean;
}) {
  const warn = over && !struck && !dimmed;
  return (
    <HStack gap="3" justify="space-between">
      <Text color="fg.muted">{label}</Text>
      <HStack
        gap="1"
        fontWeight="bold"
        color={dimmed ? 'fg.muted' : warn ? 'chart.limit' : color}
      >
        {warn && <HiMiniExclamationTriangle aria-label="Over the limit" />}
        <Text textDecoration={struck ? 'line-through' : undefined}>
          {value}
        </Text>
      </HStack>
    </HStack>
  );
}

// A location's readings in a readout, grouped by monitor: every row names its series, and
// with several monitors each gets its name as a heading over its rows. With one there is no
// heading — the card or the pin already says which place, and a monitor's name over the only
// group is a line saying nothing. `headed` is the caller's, because it is about how many
// monitors the place has, not how many happen to have a reading at this instant: a heading
// that came and went as the pointer crossed a handover would read as the layout jumping.
//
// Shared by the trace's tooltip and the map's pins, so the two print one place the same way.
export function ChartTooltipReadings({
  groups,
  headed,
}: {
  groups: Array<{
    key: string;
    heading: string;
    rows: Array<{key: string} & ComponentProps<typeof ChartTooltipRow>>;
  }>;
  headed: boolean;
}) {
  return groups.map(({key, heading, rows}, i) => (
    <Fragment key={key}>
      {headed && (
        <Text fontWeight="semibold" mt={i > 0 ? '1' : undefined}>
          {heading}
        </Text>
      )}
      {rows.map(({key: rowKey, ...row}) => (
        <ChartTooltipRow key={rowKey} {...row} />
      ))}
    </Fragment>
  ));
}
