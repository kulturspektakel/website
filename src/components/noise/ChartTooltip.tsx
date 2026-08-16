import {Box} from '@chakra-ui/react';
import {type ReactNode} from 'react';

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

// Floating readout anchored over a chart, positioned just above a point given in
// container-relative CSS pixels. The hosting container must be position:
// relative. Pointer-events are disabled so it never swallows cursor moves.
export function ChartTooltip({
  left,
  top,
  children,
}: {
  left: number;
  top: number;
  children: ReactNode;
}) {
  return (
    <Box
      position="absolute"
      left={`${left}px`}
      top={`${top}px`}
      transform="translate(-50%, calc(-100% - 8px))"
      pointerEvents="none"
      zIndex="1"
      {...CHART_READOUT_STYLE}
    >
      {children}
    </Box>
  );
}
