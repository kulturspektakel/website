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
      bg="orange.subtle"
      color="orange.fg"
      fontSize="xs"
      fontWeight="medium"
      whiteSpace="nowrap"
      aria-label={`${count} logs waiting to upload`}
    >
      <LuUpload />
      {count > 99 ? '99+' : count}
    </HStack>
  );
}
