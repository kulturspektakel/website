import {FaXmark, FaCircleInfo} from 'react-icons/fa6';
import type {FlexProps} from '@chakra-ui/react';
import {
  useDisclosure,
  Flex,
  IconButton,
  Box,
  Heading,
  Icon,
} from '@chakra-ui/react';

export default function InfoBox({
  children,
  closeable,
  title,
  ...props
}: FlexProps & {
  title?: string;
  closeable?: boolean;
}) {
  const {open, onClose} = useDisclosure({defaultOpen: true});

  if (!open) {
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
      <Icon asChild color="brand.900" mt="0.5">
        <FaCircleInfo />
      </Icon>
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
        <IconButton
          alignSelf="flex-start"
          position="relative"
          right={-1}
          top={-1}
          onClick={onClose}
        >
          <FaXmark />
        </IconButton>
      )}
    </Flex>
  );
}
