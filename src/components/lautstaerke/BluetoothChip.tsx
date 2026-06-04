import {Box} from '@chakra-ui/react';

export function BluetoothChip() {
  return (
    <Box
      as="span"
      px="2"
      py="0.5"
      rounded="sm"
      bg="blue.900"
      color="blue.200"
      fontSize="xs"
      fontFamily="mono"
      fontWeight="medium"
    >
      BT
    </Box>
  );
}
