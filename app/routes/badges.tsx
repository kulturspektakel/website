import {Heading, VStack, Text, SimpleGrid, Box, Flex} from '@chakra-ui/react';

import {createFileRoute} from '@tanstack/react-router';
import {Badge} from '../components/kultcard/Badges';
import {badgeConfig} from '../utils/badgeConfig';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/badges')({
  component: Badges,
  head: () =>
    seo({
      title: 'Badges',
      description: 'Übersicht über alle Badges',
    }),
});

export function Badges() {
  return (
    <SimpleGrid columns={[2, null, 3]} gap="10">
      {Object.keys(badgeConfig)
        .sort((a, b) => a.localeCompare(b))
        .map((badgeKey: keyof typeof badgeConfig) => (
          <VStack alignItems="center" w="100%">
            <Flex
              position="relative"
              w="100%"
              alignItems="center"
              justifyContent="center"
            >
              <Badge type={badgeKey} width="50%" />
              {badgeConfig[badgeKey].crewOnly ? (
                <Text
                  position="absolute"
                  bottom="1"
                  left="50%"
                  transform="translateX(-50%)"
                  textAlign="center"
                  fontSize="sm"
                  color="white"
                  bg="brand.900"
                  borderRadius="full"
                  px="2"
                  pointerEvents="none"
                >
                  CREW
                </Text>
              ) : null}
            </Flex>
            <Heading mt="5" textAlign="center">
              {badgeConfig[badgeKey].name}
            </Heading>
            <Text textAlign="center" fontSize="sm" color="offwhite.500">
              {badgeConfig[badgeKey].description}
            </Text>
          </VStack>
        ))}
    </SimpleGrid>
  );
}
