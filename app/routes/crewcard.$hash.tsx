import {VStack} from '@chakra-ui/react';
import InfoText from '../components/kultcard/InfoText';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {CardActivities} from '../components/kultcard/CardActivities';

const loader = createServerFn()
  .validator((data: {hash: string}) => data)
  .handler(async ({data}) => {});

export const Route = createFileRoute('/crewcard/$hash')({
  component: CrewCard,
  loader: async ({params}) => await loader({data: params}),
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

function CrewCard() {
  const cardStatus = Route.useLoaderData(); // EXAMPLE_DATA

  return (
    <VStack maxW="450px" mr="auto" ml="auto" gap="7">
      <VStack gap="5" align="stretch">
        <CardActivities data={[]} />
        <InfoText textAlign="center">
          Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
          dargestellt werden.
        </InfoText>
      </VStack>
    </VStack>
  );
}
