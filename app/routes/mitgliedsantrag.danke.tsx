import {VStack, Heading, Text, ClientOnly} from '@chakra-ui/react';
import Confetti from '../components/booking/Confetti.client';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/mitgliedsantrag/danke')({
  component: MitgliedsantragDanke,
});

function MitgliedsantragDanke() {
  return (
    <>
      <ClientOnly>
        <Confetti />
      </ClientOnly>
      <VStack gap="5" textAlign="center">
        <Heading size="3xl">Willkommen im Verein!</Heading>
        <Text>
          Vielen Dank für deine Mitgliedschaft bei uns. Wir wissen deine
          Unterstützung sehr zu schätzen. Du solltest soeben eine E-Mail
          bekommen haben, die deine Mitgliedschaft bestätigt. Wenn du Fragen
          hast, kannst du uns gerne jederzeit kontaktieren.
        </Text>
      </VStack>
    </>
  );
}
