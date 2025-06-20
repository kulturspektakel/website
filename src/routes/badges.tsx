import {Heading, VStack, Text, SimpleGrid} from '@chakra-ui/react';

import {createFileRoute} from '@tanstack/react-router';
import {Badge} from '../components/kultcard/Badges';
import {badgeConfig} from '../utils/badgeConfig';

export const Route = createFileRoute('/badges')({
  component: Badges,
});

export function Badges() {
  return (
    <SimpleGrid columns={[2, null, 3]} gap="10">
      {Object.keys(badgeConfig).map((badgeKey: keyof typeof badgeConfig) => (
        <VStack alignItems="center" w="100%">
          <Badge type={badgeKey} width="50%" />
          <Heading mt="5">{badgeConfig[badgeKey].name}</Heading>
          <Text textAlign="center" fontSize="sm" color="offwhite.500">
            {badgeConfig[badgeKey].description}
          </Text>
        </VStack>
      ))}
    </SimpleGrid>
  );
}
