import {createFileRoute, Link} from '@tanstack/react-router';
import {Box, HStack, Heading, Text, VStack} from '@chakra-ui/react';
import {
  ACTIVE_WINDOW_MS,
  MqttGate,
  decodeDb,
  useLautstaerkeCtx,
} from '../lautstaerke/context';

export const Route = createFileRoute('/lautstaerke/')({
  component: DeviceList,
});

function DeviceList() {
  return (
    <MqttGate>
      <Box>
        <Heading as="h1" size="2xl" mb="4">
          Lautstärke
        </Heading>
        <DeviceListInner />
      </Box>
    </MqttGate>
  );
}

function DeviceListInner() {
  const ctx = useLautstaerkeCtx();
  const names = Object.keys(ctx.devices).sort();
  if (names.length === 0) {
    return <Text color="gray.500">Noch keine Geräte empfangen.</Text>;
  }
  return <DeviceListItems ctx={ctx} names={names} />;
}

function DeviceListItems({
  ctx,
  names,
}: {
  ctx: ReturnType<typeof useLautstaerkeCtx>;
  names: string[];
}) {
  return (
    <VStack align="stretch" gap="2">
      {names.map((name) => {
        const state = ctx.devices[name];
        const active = ctx.now - state.lastSeen < ACTIVE_WINDOW_MS;
        const laeq = decodeDb(state.latest.laeq1s).toFixed(1);
        return (
          <Box
            key={name}
            asChild
            p="3"
            rounded="md"
            borderWidth="1px"
            _hover={{bg: 'gray.50'}}
          >
            <Link to="/lautstaerke/$device" params={{device: name}}>
              <HStack>
                <Box
                  w="3"
                  h="3"
                  rounded="full"
                  bg={active ? 'green.500' : 'gray.400'}
                />
                <Text fontFamily="mono" flex="1">
                  {name}
                </Text>
                <Text fontFamily="mono" fontWeight="bold">
                  {laeq} dB
                </Text>
              </HStack>
            </Link>
          </Box>
        );
      })}
    </VStack>
  );
}
