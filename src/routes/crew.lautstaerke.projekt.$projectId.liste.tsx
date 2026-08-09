import {createFileRoute} from '@tanstack/react-router';
import {Box, Text} from '@chakra-ui/react';
import {useState} from 'react';
import {LocationCard} from '../components/lautstaerke/LocationCard';
import {LocationPicker} from '../components/lautstaerke/LocationPicker';
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

  // Which locations are *off* the list, rather than which are on it. That way a
  // location placed on the map while this view is open arrives on the list — the set it
  // has to be in to appear is the empty one, not one that was written before it
  // existed — and the ordinary state of this page, everything shown, is no state at
  // all. Local to the view: it is a decision about how this list is arranged, and
  // taking the map and coming back is a good moment to have it back at all of them.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const toggle = (locationId: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(locationId)) next.add(locationId);
      return next;
    });

  if (locations.length === 0) {
    return (
      <Text color="gray.500" p="4">
        {/* A location can only be placed on the map, so without a Maps key there
            is no way in at all — say so rather than showing an empty list and no
            control. */}
        {project.apiKey != null
          ? 'Noch keine Standorte.'
          : 'Noch keine Standorte. Ohne Google-Maps-Schlüssel ist die Karte nicht verfügbar, daher können derzeit keine Standorte angelegt werden.'}
      </Text>
    );
  }

  const shown = locations.filter(({location}) => !hidden.has(location.id));

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
          <Text fontSize="sm" color="gray.500">
            Kein Standort ausgewählt.
          </Text>
        )}
      </Box>

      <LocationPicker
        locations={locations.map(({location}) => location)}
        shown={new Set(shown.map(({location}) => location.id))}
        onToggle={toggle}
      />
    </Box>
  );
}
