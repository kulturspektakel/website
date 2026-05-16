import {createFileRoute, Outlet} from '@tanstack/react-router';
import {ChakraProvider} from '@chakra-ui/react';
import crewTheme from '../theme-crew';

export const Route = createFileRoute('/crew')({
  component: CrewLayout,
});

function CrewLayout() {
  return (
    <ChakraProvider value={crewTheme}>
      <Outlet />
    </ChakraProvider>
  );
}
