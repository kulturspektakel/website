import {InfoIcon} from '@chakra-ui/icons';
import type {BoxProps} from '@chakra-ui/react';
import {useDisclosure, Flex, CloseButton, Box, Heading} from '@chakra-ui/react';

export default function InfoBox({
  children,
  closeable,
  title,
  ...props
}: BoxProps & {
  title?: string;
  closeable?: boolean;
}) {
  //   const applicationsOpen = useApplicationsOpen();
  const {isOpen, onClose} = useDisclosure({defaultIsOpen: true});

  if (!isOpen) {
    return null;
  }

  return (
    <Flex
      borderRadius="lg"
      bg="offwhite.200"
      alignItems="start"
      p="3"
      gap="2"
      {...props}
    >
      <InfoIcon color="brand.900" />
      <Box>
        {title && (
          <Heading
            size="sm"
            as="h4"
            fontFamily="Shrimp"
            textTransform="uppercase"
            mt="-0.35"
            mb="1"
          >
            {title}
          </Heading>
        )}
        {children}
      </Box>
      {closeable && (
        <CloseButton
          alignSelf="flex-start"
          position="relative"
          right={-1}
          top={-1}
          onClick={onClose}
        />
      )}
    </Flex>
  );
}
