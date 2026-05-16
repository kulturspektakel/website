import {Box} from '@chakra-ui/react';

export function BatteryChip({mv}: {mv: number}) {
  return (
    <Box
      as="span"
      px="2"
      py="0.5"
      rounded="sm"
      bg="gray.100"
      color="gray.700"
      fontSize="xs"
      fontFamily="mono"
      fontWeight="medium"
      whiteSpace="nowrap"
    >
      {(mv / 1000).toFixed(2)} V
    </Box>
  );
}
