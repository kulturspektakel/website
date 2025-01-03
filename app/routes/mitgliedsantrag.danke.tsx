import {VStack, Heading, Text} from '@chakra-ui/react';
import {ClientOnly} from 'remix-utils/client-only';
import Confetti from '~/components/booking/Confetti.client';

export default function MitgliedsantragDanke() {
  return (
    <>
      <ClientOnly>{() => <Confetti />}</ClientOnly>
      <VStack gap="5" textAlign="center">
        <Heading size="3xl">Willkommen im Verein!</Heading>
        <Text>
          Vielen Dank für deine Mitgliedschaft bei uns. Wir wissen deine
          Unterstützung sehr zu schätzen. Du solltest so eben eine E-Mail
          bekommen, die deine Mitgliedschaft bestätigt. Wenn du Fragen hast,
          kannst du uns gerne jederzeit kontaktieren.
        </Text>
      </VStack>
    </>
  );
}
