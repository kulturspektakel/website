import {Box, Heading, Stack, Text, VStack} from '@chakra-ui/react';
import type {V2_MetaFunction} from '@remix-run/node';
import {mergeMeta} from '~/utils/mergeMeta';

export const meta: V2_MetaFunction = mergeMeta(() => [{title: `Logo`}]);

export default function Logo() {
  return (
    <VStack spacing="5">
      <Heading>Logo</Heading>
      <Heading as="h2">Schriftarten</Heading>
      <Stack direction="row">
        <Box>
          <Text fontFamily="Shrimp">ABCDEFGHIJKLMNOPQRSTUVWXYZ</Text>
          <Heading size="sm">Shrimp</Heading>
          Verwendet für Überschriften, einzelne Worte, Schilder, etc.
          Ausschließlich in Großbuchstaben!
        </Box>
        <Box>
          <Text fontFamily="Space Grotesk">AaBbCc</Text>
          <Box>
            <Heading size="sm">Space Grotesk</Heading>
          </Box>
        </Box>
      </Stack>

      <Heading as="h2">Farben</Heading>
      <Stack direction="row">
        <Box>
          <Box bg="brand.500" w="200" h="100" borderRadius="md"></Box>
          <Heading size="md">Kulturspektakel Rot</Heading>
          #E12E2E
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
        <Box>
          <Box bg="brand.500" w="200" h="100" borderRadius="md"></Box>
          <Heading size="md">Kultbühnen Gelb</Heading>
          #E12E2E
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
        <Box>
          <Box bg="brand.500" w="200" h="100" borderRadius="md"></Box>
          <Heading size="md">Waldbühnen Grün</Heading>
          #E12E2E
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
        <Box>
          <Box bg="brand.500" w="200" h="100" borderRadius="md"></Box>
          <Heading size="md">DJ-Area Lila</Heading>
          #E12E2E
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
      </Stack>
    </VStack>
  );
}
