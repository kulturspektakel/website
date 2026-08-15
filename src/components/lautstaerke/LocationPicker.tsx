import {Box, Button, Span, Text} from '@chakra-ui/react';
import {LuChevronDown, LuMapPin} from 'react-icons/lu';
import {
  MenuCheckboxItem,
  MenuContent,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {memo} from 'react';
import type {NoiseLocationItem} from './projectView';

// Opens upwards, which is the only direction there is: the button is at the foot of the
// page. Hoisted because it feeds zag's positioning machine as context — a fresh object per
// render would be a new value on every frame of a crop drag, for a placement that never
// changes.
const POSITIONING = {placement: 'top-start'} as const;

/**
 * One of the two controls in the list view's bottom toolbar: every location the project
 * has, as a row you tick to put it on the list or untick to take it off again.
 *
 * It replaced folding the cards one at a time. The cards divide the page's height
 * between them, so what matters is how many are on it — and that is a decision about
 * the list as a whole, made in one place, rather than one taken card by card in the
 * middle of the thing being rearranged.
 *
 * A row of chips was that one place first, and it was the roster laid out flat: every
 * stage readable at a glance, the lit ones the ones you were watching. What it cost was
 * width — a festival with a dozen stages scrolled sideways, so the far end of its own
 * roster was off screen — and a bar as tall as a pressable chip, taken off the charts,
 * which is the room this control exists to hand out. So it is a menu now: one button's
 * worth of toolbar, and the whole roster at full length when it is open.
 *
 * The same shape as the windows picker in the header (see LevelPicker), deliberately —
 * both pick a *set*, neither is a choice between two things, and a page whose two
 * multi-picks looked like two different kinds of control would be saying they differ
 * when they don't. So: a checkbox menu that stays open, behind a button that names the
 * first pick and counts the rest.
 *
 * Every location is on the menu whatever the crop or the playhead says — the list is a
 * set of places, not of whatever is measuring at this instant.
 *
 * The bar it sits in belongs to the view rather than to this control: the column count
 * stands beside it, and the two are one strip (see the list route).
 *
 * Memoized, which matters more here than the flat row of chips it replaced ever needed.
 * The view around it re-renders on every animation frame of a timeline crop drag — that is
 * why the cards beside it are memoized too — and a menu is not a leaf: its content is
 * mounted whether or not it is open, so a festival's worth of checkbox rows, each an Ark
 * component with its own indicator and icon, would reconcile sixty times a second behind a
 * closed button. All three props are pinned by the route for this to hold.
 */
export const LocationPicker = memo(function LocationPicker({
  locations,
  shown,
  onToggle,
}: {
  locations: NoiseLocationItem[];
  // Ids on the list. A set rather than a filtered list, because the menu shows the ones
  // that are off as well.
  shown: ReadonlySet<string>;
  onToggle: (locationId: string) => void;
}) {
  // What the button has to account for, in the one order there is (the layout sorted the
  // roster — see compareLocations): the places on the list, named the way the menu names
  // them, so the label and the ticks can't disagree about which is first.
  const picked = locations.filter((l) => shown.has(l.id));

  return locations.length === 0 ? (
    <Text fontSize="sm" color="fg.subtle">
      Noch keine Standorte.
    </Text>
  ) : (
    // Stays open while boxes are ticked: picking which places are on the list is
    // several presses, and a menu that closed after each would have to be reopened
    // for every one of them — with the list reflowing underneath in between.
    <MenuRoot closeOnSelect={false} positioning={POSITIONING}>
      <MenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          px="2"
          gap="1"
          fontWeight="normal"
          // Gives way to the column count beside it rather than pushing it off the strip:
          // the stage name inside truncates, and that select is two words wide whatever
          // happens.
          maxW="full"
          minW="0"
          // Names the control *and* what it is set to: the visible "+3" says how many
          // more without saying which, and a button whose accessible name was the
          // first stage alone would leave a reader knowing only that one.
          aria-label={
            picked.length === 0
              ? 'Standorte auswählen'
              : `Angezeigte Standorte: ${picked
                  .map((l) => l.locationName)
                  .join(', ')}`
          }
        >
          <Box asChild flexShrink="0" color="fg.muted">
            <LuMapPin />
          </Box>
          {/* The first place on the list, and truncated: a stage name can be long, and
              the toolbar has the column count in it as well.
              The fallback is for the one paint where there is no first place — the list
              always has a card on it (see toggledSelection), except in the frame after a
              navigation to another project, where the selection still names the previous
              one's. */}
          <Span truncate>{picked[0]?.locationName ?? 'Standorte'}</Span>
          {picked.length > 1 && (
            <Span color="fg.muted" flexShrink="0">
              +{picked.length - 1}
            </Span>
          )}
          <Box asChild flexShrink="0" color="fg.muted">
            <LuChevronDown />
          </Box>
        </Button>
      </MenuTrigger>
      {/* Scrolls rather than growing past the viewport: a dozen stages is a menu taller
          than the page it is opening over, and the far end of it was exactly what the row
          of chips could not reach either. */}
      <MenuContent maxH="20rem" overflowY="auto">
        {locations.map((location) => (
          // Every place stays tickable, including the last one lit — where ticking it
          // does nothing at all (see toggledSelection). Not greyed out: a whole menu
          // of places with one dead row reads as if that row were unavailable, when
          // what is true is the opposite — it is the only one being shown.
          <MenuCheckboxItem
            key={location.id}
            value={location.id}
            checked={shown.has(location.id)}
            onCheckedChange={() => onToggle(location.id)}
          >
            {location.locationName}
          </MenuCheckboxItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
});
