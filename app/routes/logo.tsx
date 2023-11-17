import {
  Box,
  Button,
  Heading,
  Link,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import type {V2_MetaFunction} from '@remix-run/node';
import {mergeMeta} from '~/utils/mergeMeta';

export const meta: V2_MetaFunction = mergeMeta(() => [{title: `Logo`}]);

export default function Logo() {
  return (
    <VStack spacing="16">
      <Heading>Logo</Heading>
      <Heading>Typographie</Heading>
      <SimpleGrid columns={2} gap="5">
        <VStack spacing="3" align="start">
          <Heading as="h3" size="lg">
            Shrimp
          </Heading>
          <Box
            p="2"
            borderRadius="md"
            fontFamily="Shrimp"
            bg="white"
            fontSize="lg"
            textTransform="uppercase"
            boxShadow="base"
          >
            The{' '}
            <Text
              display="inline"
              color="white"
              sx={{WebkitTextStroke: '1px black'}}
            >
              quick
            </Text>{' '}
            brown fox jumps over the lazy{' '}
            <Text
              display="inline"
              color="white"
              sx={{WebkitTextStroke: '1px black'}}
            >
              dog
            </Text>
            !
          </Box>
          <Text>
            Verwendet für Überschriften, einzelne Worte, Schilder, etc.
            Ausschließlich in Großbuchstaben. Hervorhebungen durch invertierten
            Text mit Umrandung.
          </Text>
          <Link
            target="_blank"
            href="https://unblast.com/shrimp-sans-serif-typeface/"
          >
            <Button>Download</Button>
          </Link>
        </VStack>
        <VStack spacing="3" align="start">
          <Heading as="h3" size="lg">
            Space Grotesk
          </Heading>
          <Box
            p="2"
            borderRadius="md"
            fontFamily="Space Grotesk"
            bg="white"
            fontSize="lg"
            boxShadow="base"
          >
            The{' '}
            <Text fontWeight="bold" display="inline">
              quick
            </Text>{' '}
            brown fox jumps over the lazy{' '}
            <Text fontWeight="bold" display="inline">
              dog
            </Text>
            !
          </Box>
          <Text>
            Verwendet für Fließtexte und kleinere Überschriften. Verschiedene
            Schnitte für Hervorhebungen verfügbar.
          </Text>
          <Link
            target="_blank"
            href="https://floriankarsten.github.io/space-grotesk/"
          >
            <Button>Download</Button>
          </Link>
        </VStack>
      </SimpleGrid>

      <Heading>Farben</Heading>
      <SimpleGrid columns={[2, 4]} gap="5">
        <Box>
          <Box
            bg="brand.500"
            w="200"
            h="100"
            borderRadius="md"
            mb="2"
            p="2"
            boxShadow="base"
          >
            <Heading size="md">Kulturspektakel Rot</Heading>
          </Box>
          #E12E2E
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
        <Box>
          <Box
            bg="#F0BD51"
            w="200"
            h="100"
            borderRadius="md"
            mb="2"
            p="2"
            boxShadow="base"
          >
            <Heading size="md">Kultbühnen Gelb</Heading>
          </Box>
          #F0BD51
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
        <Box>
          <Box
            bg="#5DA65C"
            w="200"
            h="100"
            borderRadius="md"
            mb="2"
            p="2"
            boxShadow="base"
          >
            <Heading color="white" size="md">
              Waldbühnen Grün
            </Heading>
          </Box>
          #5DA65C
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
        <Box>
          <Box
            bg="brand.900"
            w="200"
            h="100"
            borderRadius="md"
            mb="2"
            p="2"
            boxShadow="base"
          >
            <Heading color="white" size="md">
              DJ-Area Lila
            </Heading>
          </Box>
          #E12E2E
          <br />
          C5 M96 Y99 K1
          <br />
          Pantone 186
        </Box>
      </SimpleGrid>
      <Heading>Sprache</Heading>
      <SimpleGrid columns={[1, 2, 4]} gap="5">
        <Box>
          <Heading as="h3" size="md">
            Geschlechtergerechte Sprache
          </Heading>
          <Text>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
          </Text>
        </Box>
        <Box>
          <Heading as="h3" size="md">
            Eigennamen
          </Heading>
          <Text>Große Bühne immer mit großem G</Text>
          <Text>
            Wenn "Kult" als Kurzform von Kulturspektakel verwendet wird, nicht
            in Großbuchstaben ("KULT").
          </Text>
        </Box>
        <Box>
          <Heading as="h3" size="md">
            Geschlechtergerechte Sprache
          </Heading>
          <Text>Große Bühne</Text>
        </Box>
      </SimpleGrid>
    </VStack>
  );
}
