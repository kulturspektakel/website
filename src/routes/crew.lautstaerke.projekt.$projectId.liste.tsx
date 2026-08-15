import {createFileRoute} from '@tanstack/react-router';
import {Box, Text} from '@chakra-ui/react';
import {useEffect, useState} from 'react';
import {LocationCard} from '../components/lautstaerke/LocationCard';
import {LocationPicker} from '../components/lautstaerke/LocationPicker';
import {
  defaultSelection,
  readSelection,
  resolveSelection,
  writeSelection,
} from '../components/lautstaerke/locationSelection';
import {useProjectView} from '../components/lautstaerke/projectView';

export const Route = createFileRoute(
  '/crew/lautstaerke/projekt/$projectId/liste',
)({
  // How many columns the cards are laid out in — the list and the grid are one view,
  // and the only thing that differs is how much width a card gets. In the URL, like
  // which view is on screen, because it is the same kind of fact: what you are looking
  // at, and something worth being able to link to. Anything but a 2 is one column.
  validateSearch: (search: Record<string, unknown>): {spalten?: 2} =>
    Number(search.spalten) === 2 ? {spalten: 2} : {},
  component: ProjectListView,
});

function ProjectListView() {
  // The layout resolves each location's monitors at the playhead, which the map's pins
  // need; a card is about the place over the whole crop and reads the location itself.
  const {project, locations} = useProjectView();
  const {spalten} = Route.useSearch();

  // The roster: every location the project has, in the one order there is (the layout
  // sorted them — see compareLocations). Both the chips and the stored ids follow it.
  const roster = locations.map(({location}) => location);

  // Which locations are on the list, and it is remembered — per project, in this browser
  // (see locationSelection.ts). The cards divide the page's height between them, so this
  // is the decision that governs whether the view is readable at all, and having it back
  // at everything after a trip to the map meant re-making it every time. A fresh browser
  // starts on the first three.
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(defaultSelection(roster)),
  );

  // The stored value is read after mount rather than in the initializer above, and that
  // is the whole reason this is an effect: the page is server-rendered, and a lazy
  // initializer reading localStorage would hand hydration a different set of cards than
  // the server sent. Same shape as CrewCardInfo. The default is on screen for the frame
  // in between.
  useEffect(() => {
    setSelected(new Set(resolveSelection(readSelection(project.id), roster)));
    // roster is deliberately not a dependency — it is a new array every render, and what
    // this reads is the store, once per project. A location added afterwards is picked up
    // by the chips and the map, and stays off the list until it is pressed.
  }, [project.id]);

  // Computed here and not inside the updater: React invokes updaters twice in
  // development, and writing to storage is not the kind of thing to do twice.
  const toggle = (locationId: string) => {
    const next = new Set(selected);
    if (!next.delete(locationId)) next.add(locationId);
    setSelected(next);
    // Stored in display order and only the places that still exist, so what comes back
    // next time is the arrangement rather than a set with the ghosts of deleted
    // locations in it.
    writeSelection(
      project.id,
      roster.filter((l) => next.has(l.id)).map((l) => l.id),
    );
  };

  if (locations.length === 0) {
    return (
      <Text color="fg.subtle" p="4">
        {/* A location can only be placed on the map, so without a Maps key there
            is no way in at all — say so rather than showing an empty list and no
            control. */}
        {project.apiKey != null
          ? 'Noch keine Standorte.'
          : 'Noch keine Standorte. Ohne Google-Maps-Schlüssel ist die Karte nicht verfügbar, daher können derzeit keine Standorte angelegt werden.'}
      </Text>
    );
  }

  const shown = locations.filter(({location}) => selected.has(location.id));

  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0">
      {/* Its own gutter, unlike the map beside it: the content region is edge-to-edge
          now, and a column of bordered cards run right up against the window reads as a
          table that has lost its edge. The map wants the opposite and gets it.

          Fills what the toolbars leave, so the cards have something to divide: each
          takes an equal share of it (see LocationCard), which is what makes one location
          a full-page chart and four a quarter of one each — down to the trace's own
          floor, past which the list scrolls. */}
      <Box
        display="grid"
        // Two columns, unless there is only one card to put in them: a lone location
        // pinned to the left half with nothing beside it is a grid of one, and the room
        // it left empty is room its chart could have had. Three cards keep the second
        // row half-width — the last one simply sits in the first column, which is what
        // a grid does, and stretching it would make one card wider than the two it is
        // there to be compared with.
        gridTemplateColumns={
          spalten === 2 && shown.length > 1
            ? 'repeat(2, minmax(0, 1fr))'
            : '1fr'
        }
        // Every row the same height, which is what divides the page between the cards —
        // a grid rather than a flex column even at one column, so the two layouts are
        // the same rule with a different column count. A row still can't be shorter
        // than the trace's own floor, and past that the list scrolls.
        gridAutoRows="1fr"
        gap="3"
        p="4"
        flex="1"
        minH="0"
      >
        {shown.map(({location, assignments}) => (
          <LocationCard
            key={location.id}
            location={location}
            assignments={assignments}
          />
        ))}
        {shown.length === 0 && (
          <Text fontSize="sm" color="fg.subtle">
            Kein Standort ausgewählt.
          </Text>
        )}
      </Box>

      <LocationPicker
        locations={roster}
        shown={new Set(shown.map(({location}) => location.id))}
        onToggle={toggle}
      />
    </Box>
  );
}
