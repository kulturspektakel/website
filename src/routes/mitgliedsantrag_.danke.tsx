import {VStack, Heading, Text} from '@chakra-ui/react';
import {lazy, Suspense} from 'react';
import {createFileRoute} from '@tanstack/react-router';

const Confetti = lazy(() => import('../components/booking/Confetti'));
import {seo} from '../utils/seo';

export const Route = createFileRoute('/mitgliedsantrag_/danke')({
  component: MitgliedsantragDanke,
  head: () =>
    seo({
      title: 'Mitgliedsantrag',
      description: 'Mitgliedsantrag für die Aufnahme in den Verein',
    }),
});

function MitgliedsantragDanke() {
  return (
    <>
      <Suspense>
        <Confetti />
      </Suspense>
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
