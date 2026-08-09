import {Button, HStack, Text} from '@chakra-ui/react';
import type {NoiseLocationItem} from './projectView';

/**
 * The list view's bottom toolbar: every location the project has, as a chip you press
 * to put it on the list or take it off again.
 *
 * It replaced folding the cards one at a time. The cards divide the page's height
 * between them, so what matters is how many are on it — and that is a decision about
 * the list as a whole, made in one place, rather than one taken card by card in the
 * middle of the thing being rearranged. It also reads as what it is: the roster of the
 * site, with the ones you are watching lit.
 *
 * Every chip is here whatever the crop or the playhead says — the list is a set of
 * places, not of whatever is measuring at this instant.
 */
export function LocationPicker({
  locations,
  shown,
  onToggle,
}: {
  locations: NoiseLocationItem[];
  // Ids on the list. A set rather than a filtered list, because the toolbar shows the
  // ones that are off as well.
  shown: ReadonlySet<string>;
  onToggle: (locationId: string) => void;
}) {
  return (
    <HStack
      gap="2"
      px="4"
      py="2"
      // Sticks to the foot of the scroll box, so the roster is reachable without
      // scrolling back down a list it is the control for. Opaque and ruled off, like
      // the toolbars at the top.
      position="sticky"
      bottom="0"
      zIndex="2"
      flexShrink="0"
      bg="gray.900"
      borderTopWidth="1px"
      borderColor="gray.800"
      // Scrolls sideways rather than wrapping: a festival with a dozen stages would
      // otherwise grow a toolbar three rows tall and take that height off the charts,
      // which is the space this control exists to hand out.
      overflowX="auto"
      overflowY="hidden"
    >
      {locations.map((location) => {
        const on = shown.has(location.id);
        return (
          <Button
            key={location.id}
            size="xs"
            flexShrink="0"
            // Lit when it is on the list, outlined when it isn't — a pressed state
            // rather than two different controls, which is also what `aria-pressed`
            // says to a screen reader.
            variant={on ? 'solid' : 'outline'}
            colorPalette={on ? 'yellow' : undefined}
            aria-pressed={on}
            onClick={() => onToggle(location.id)}
          >
            {location.locationName}
          </Button>
        );
      })}
      {locations.length === 0 && (
        <Text fontSize="sm" color="gray.500">
          Noch keine Standorte.
        </Text>
      )}
    </HStack>
  );
}
