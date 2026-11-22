import {
  Avatar,
  Box,
  defineStyle,
  Flex,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';

const ringCss = defineStyle({
  outlineWidth: '3px',
  outlineColor: 'brand.500',
  outlineOffset: '2px',
  outlineStyle: 'solid',
});

/**
 * The CrewCard as a card: the holder's picture and name, their status, the
 * totals and a footer line (card ids). "ungültig" across it when `invalid`.
 */
export function CrewCardFace({
  name,
  profilePicture,
  privileged,
  invalid,
  totals,
  footer,
  mb,
}: {
  name: string | null;
  profilePicture: string | null | undefined;
  privileged: boolean;
  invalid: boolean;
  totals: Record<string, number>;
  footer: React.ReactNode;
  mb: string;
}) {
  return (
    <Flex
      direction="column"
      shadow="2xl"
      bg="white"
      borderRadius="2xl"
      aspectRatio={0.63}
      alignItems="center"
      position="relative"
      justifyContent="space-between"
      p="5"
      pb="3"
      maxW="290px"
      w="full"
      mx="auto"
      overflow="hidden"
      mb={mb}
    >
      <Box
        w="15%"
        aspectRatio={6}
        bg="offwhite.100"
        borderRadius="full"
        boxShadow="inset"
      />
      <Box w="50%" aspectRatio={1}>
        <Avatar.Root css={ringCss} size="full" background="brand.500">
          <Avatar.Fallback
            name={name ?? '?'}
            fontFamily="Shrimp"
            fontSize="7xl"
            color="white"
            mt="4"
          />
          {profilePicture && (
            <Avatar.Image
              width="auto"
              aspectRatio={1}
              objectFit="cover"
              src={profilePicture}
            />
          )}
        </Avatar.Root>
      </Box>
      <Box textAlign="center">
        <Heading fontSize="3xl">{name ?? 'Unbekannt'}</Heading>
        <Text fontSize="lg" mt="1" opacity="0.5">
          {privileged ? 'Bonbude' : 'Kulturspektakel Crew'}
        </Text>
      </Box>
      {invalid && (
        <Box
          background="red.500"
          color="white"
          position="absolute"
          fontWeight="bold"
          textTransform="uppercase"
          transformOrigin="top center"
          transform="translateX(50%) rotate(45deg)"
          top="10"
          right="10"
          fontSize="xl"
          px="20"
        >
          ungültig
        </Box>
      )}
      <VStack gap="2" w="full">
        <Flex direction="row" w="full" mb="3">
          {Object.entries(totals).map(([label, value]) => (
            <Flex
              key={label}
              gap="3"
              flexDirection="column"
              textAlign="center"
              flexGrow="1"
              flexBasis="0"
            >
              <Box
                textTransform="uppercase"
                opacity="0.5"
                fontSize="xs"
                fontWeight="bold"
              >
                {label}
              </Box>
              <Text mt="-5" fontSize="4xl">
                {value}
              </Text>
            </Flex>
          ))}
        </Flex>
        <Text fontSize="sm" textAlign="center" opacity="0.5">
          {footer}
        </Text>
      </VStack>
    </Flex>
  );
}
