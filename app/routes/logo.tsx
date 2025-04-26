import {
  Box,
  Heading,
  SimpleGrid,
  Text,
  VStack,
  Image,
  Flex,
} from '@chakra-ui/react';
import LinkButton from '../components/LinkButton';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/logo')({
  component: Logo,
  head: () => ({
    meta: [
      {
        title: `Logo`,
        description:
          'Logos, Typographie, Farben und Sprache des Kulturspektakels',
      },
    ],
  }),
});

function LogoCol({filename}: {filename: string}) {
  return (
    <VStack gap="3">
      <Flex
        p="2"
        borderRadius="md"
        fontFamily="Shrimp"
        bg="white"
        fontSize="lg"
        textTransform="uppercase"
        boxShadow="base"
        h="200px"
        alignItems="center"
        textAlign="center"
      >
        <Image
          src={`/logos/${filename}.svg`}
          h="100%"
          objectFit="contain"
          alt="Kulturspektakel Gauting Logo"
        />
      </Flex>
      Bildmarke
      <Flex gap="2">
        <LinkButton
          href={`/logos/${filename}.png`}
          download={`${filename}.png`}
        >
          PNG
        </LinkButton>
        <LinkButton
          href={`/logos/${filename}.pdf`}
          download={`${filename}.pdf`}
        >
          PDF
        </LinkButton>
        <LinkButton
          href={`/logos/${filename}.svg`}
          download={`${filename}.svg`}
        >
          SVG
        </LinkButton>
      </Flex>
    </VStack>
  );
}

function Logo() {
  return (
    <VStack>
      <Heading size="3xl" mb="8">
        Logo
      </Heading>
      <SimpleGrid columns={[1, 3]} gap="5">
        <LogoCol filename="logo" />
        <LogoCol filename="logo-tall" />
        <LogoCol filename="logo-wide" />
      </SimpleGrid>
      <Heading mt="16" mb="8">
        Typographie
      </Heading>
      <SimpleGrid columns={2} gap="5">
        <VStack gap="3" align="start">
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
            <Text display="inline" color="white" WebkitTextStroke="1px black">
              quick
            </Text>{' '}
            brown fox jumps over the lazy{' '}
            <Text display="inline" color="white" WebkitTextStroke="1px black">
              dog
            </Text>
            !
          </Box>
          <Text>
            Verwendet für Überschriften, einzelne Worte, Schilder, etc.
            Ausschließlich in Großbuchstaben. Hervorhebungen durch invertierten
            Text mit Umrandung.
          </Text>
          <LinkButton
            target="_blank"
            href="https://unblast.com/shrimp-sans-serif-typeface/"
          >
            Download
          </LinkButton>
        </VStack>
        <VStack gap="3" align="start">
          <Heading as="h3" size="md">
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
          <LinkButton
            target="_blank"
            href="https://floriankarsten.github.io/space-grotesk/"
          >
            Download
          </LinkButton>
        </VStack>
      </SimpleGrid>

      <Heading mt="16" mb="8">
        Farben
      </Heading>
      <SimpleGrid columns={[2, 4]} gap="5">
        <Box>
          <Box
            bg="brand.500"
            h="100px"
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
            h="100px"
            borderRadius="md"
            mb="2"
            p="2"
            boxShadow="base"
          >
            <Heading size="md">Kultbühnen Gelb</Heading>
          </Box>
          #F0BD51
        </Box>
        <Box>
          <Box
            bg="#5DA65C"
            h="100px"
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
        </Box>
        <Box>
          <Box
            bg="brand.900"
            h="100px"
            borderRadius="md"
            mb="2"
            p="2"
            boxShadow="base"
          >
            <Heading color="white" size="md">
              DJ-Area Lila
            </Heading>
          </Box>
          #100A28
        </Box>
      </SimpleGrid>
      <Heading mt="16" mb="8">
        Sprache
      </Heading>
      <SimpleGrid columns={[1, 2]} gap="5">
        <VStack gap="3" align="start">
          <Heading as="h3" size="md">
            Geschlechtergerechte Sprache
          </Heading>
          <Text>
            Grundsätzlich versuchen wir geschlechtergerechte Sprache zu
            verwenden und verwenden den Doppelpunkt um zu gendern (z.B.
            Musiker:innen).
          </Text>
        </VStack>
        <VStack gap="3" align="start">
          <Heading as="h3" size="md">
            Eigennamen
          </Heading>
          <Text>
            Wenn "Kult" als Kurzform von Kulturspektakel verwendet wird, nicht
            in Großbuchstaben ("KULT").
          </Text>
          <Text>Eignenamen wie "Große Bühne" immer mit großem G.</Text>
        </VStack>
      </SimpleGrid>
    </VStack>
  );
}
