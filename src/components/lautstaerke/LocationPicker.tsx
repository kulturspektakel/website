import {Box, HStack, Text} from '@chakra-ui/react';
import {LuMapPin} from 'react-icons/lu';
import {Chip} from './Chip';
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
 *
 * The same chips as everywhere else in the section (see Chip), pin included: these name
 * places, and so does the one in a device page's toolbar, so they are one kind of object at
 * two sizes rather than a roster that happens to be built out of buttons. What is theirs
 * alone is the lit state and the colour of it.
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
      bg="bg"
      borderTopWidth="1px"
      borderColor="border"
      // Scrolls sideways rather than wrapping: a festival with a dozen stages would
      // otherwise grow a toolbar three rows tall and take that height off the charts,
      // which is the space this control exists to hand out.
      overflowX="auto"
      overflowY="hidden"
    >
      {locations.map((location) => {
        const on = shown.has(location.id);
        return (
          // Lit yellow when it is on the list, an empty outline when it isn't — one
          // pressed state rather than two different controls, which is also what
          // `aria-pressed` says to a screen reader. The off chips being outlines is what
          // makes the roster readable at a glance: the places you are watching are the
          // solid ones. `md`, so the chips keep the height the buttons here had — a roster
          // is pressed at, not just read.
          <Chip
            key={location.id}
            asChild
            pressable
            selected={on}
            size="md"
            flexShrink="0"
            colorPalette={on ? 'accent' : 'gray'}
          >
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(location.id)}
            >
              <Box asChild flexShrink="0">
                <LuMapPin />
              </Box>
              {location.locationName}
            </button>
          </Chip>
        );
      })}
      {locations.length === 0 && (
        <Text fontSize="sm" color="fg.subtle">
          Noch keine Standorte.
        </Text>
      )}
    </HStack>
  );
}
