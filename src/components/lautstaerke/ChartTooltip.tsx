import {Box} from '@chakra-ui/react';
import {type ReactNode} from 'react';

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
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.600"
      rounded="md"
      px="2"
      py="1"
      whiteSpace="nowrap"
      zIndex="1"
    >
      {children}
    </Box>
  );
}
