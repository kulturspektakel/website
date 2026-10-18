import {useState} from 'react';
import {Button, Field, NativeSelectField, Stack, Text} from '@chakra-ui/react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
import {NativeSelectRoot} from '../chakra-snippets/native-select';
import {toaster} from '../chakra-snippets/toaster';
import {importNoiseLineup, noiseLineupAreas} from '../../routes/crew.noise';
import {noiseQueryKeys} from './queries';
import {errorToast} from '../toast';
import {useProjectView, type NoiseLocationItem} from './projectView';
import {Name} from './Name';

// Pins a stage's lineup to a place: a comment per band playing there while the project
// runs, named for the band and spanning its set (see importNoiseLineup). What the card's
// "Import band lineup…" opens — so a reading at the main stage can be read against who was
// on it.
//
// How many bands there are is said before anything is written, so it is clear what Import
// will add.
// Bands already imported here are skipped by the server, so a second import is harmless.
export function ImportLineupDialog({
  open,
  onClose,
  location,
}: {
  open: boolean;
  onClose: () => void;
  location: NoiseLocationItem;
}) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import band lineup</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Mounted per opening, so the area picked last time is not kept. */}
        {open && <ImportForm location={location} onClose={onClose} />}
      </DialogContent>
    </DialogRoot>
  );
}

function ImportForm({
  location,
  onClose,
}: {
  location: NoiseLocationItem;
  onClose: () => void;
}) {
  const {project, refresh} = useProjectView();
  const areas = useQuery({
    queryKey: noiseQueryKeys.lineupAreas(project.id),
    queryFn: () => noiseLineupAreas({data: {projectId: project.id}}),
    // A lineup is settled long before the festival; reopening the dialog need not ask again.
    staleTime: Infinity,
  });
  const [areaId, setAreaId] = useState<string | null>(null);
  const area =
    areas.data?.find((a) => a.id === areaId) ?? areas.data?.[0] ?? null;

  const save = useMutation({
    mutationFn: (picked: string) =>
      importNoiseLineup({
        data: {projectId: project.id, locationId: location.id, areaId: picked},
      }),
    onSuccess: async ({created, skipped}) => {
      await refresh();
      toaster.create({
        type: 'success',
        title:
          created === 0
            ? 'Lineup already imported'
            : `${created} ${created === 1 ? 'band' : 'bands'} imported`,
        description:
          created > 0 && skipped > 0
            ? `${skipped} already there were skipped.`
            : undefined,
      });
      onClose();
    },
    onError: errorToast('Lineup could not be imported'),
  });

  return (
    <>
      <DialogBody>
        {areas.isPending ? (
          <Text color="fg.muted">Loading stages…</Text>
        ) : areas.isError ? (
          <Text color="fg.error">Stages could not be loaded.</Text>
        ) : !area ? (
          <Text color="fg.muted">
            Nobody is playing on any stage during <Name>{project.name}</Name>.
          </Text>
        ) : (
          <Stack gap="4">
            <Field.Root>
              <Field.Label>Area</Field.Label>
              <NativeSelectRoot size="sm">
                <NativeSelectField
                  value={area.id}
                  onChange={(e) => setAreaId(e.currentTarget.value)}
                >
                  {areas.data.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            {/* How many, not which: the bands are the lineup, which is known, and the
                comments are on the chart once imported. */}
            <Text fontSize="sm" color="fg.muted">
              {area.bands.length} {area.bands.length === 1 ? 'band' : 'bands'}{' '}
              will be added to <Name>{location.locationName}</Name>.
            </Text>
          </Stack>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          disabled={!area}
          loading={save.isPending}
          onClick={() => area && save.mutate(area.id)}
        >
          Import
        </Button>
      </DialogFooter>
    </>
  );
}
