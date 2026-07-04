import {HStack} from '@chakra-ui/react';
import {LuUpload} from 'react-icons/lu';

// Number of log files the connected device still has to upload, from the BLE
// uploads characteristic. Only rendered when there's a pending count (> 0), so
// it disappears once the device has caught up. Amber to read as pending work.
export function UploadsChip({count}: {count: number}) {
  return (
    <HStack
      as="span"
      gap="1"
      px="2"
      py="0.5"
      rounded="sm"
      bg="orange.900"
      color="orange.200"
      fontSize="xs"
      fontFamily="mono"
      fontWeight="medium"
      whiteSpace="nowrap"
      aria-label={`${count} Logs warten auf Upload`}
    >
      <LuUpload />
      {count > 99 ? '99+' : count}
    </HStack>
  );
}
