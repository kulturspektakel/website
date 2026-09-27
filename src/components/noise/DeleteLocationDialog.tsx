import {Button, Text} from '@chakra-ui/react';
import {useMutation} from '@tanstack/react-query';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
import {toaster} from '../chakra-snippets/toaster';
import {deleteNoiseLocation} from '../../routes/crew.noise';
import {errorToast} from './toast';
import {useProjectView, type NoiseLocationItem} from './projectView';

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// "a, b and c", the way the sentence below reads.
const listed = (parts: string[]) =>
  parts.length < 2
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;

// Deleting a place, behind a question: it is the one thing on the card that cannot be taken
// back, and it takes more with it than its name — every placement there and every limit,
// which is what the question says, in numbers, so nobody finds out afterwards that the
// permit went too.
//
// A dialog rather than the browser's confirm(), so it is the page's own type and buttons,
// and so Delete can show that it is working while the transaction runs.
export function DeleteLocationDialog({
  open,
  onClose,
  location,
}: {
  open: boolean;
  onClose: () => void;
  location: NoiseLocationItem;
}) {
  const {project, refresh} = useProjectView();
  // The tags pinned to this place go too (see deleteNoiseLocation), so they are counted
  // with the rest.
  const tags = project.tags.filter((t) => t.locationId === location.id).length;

  const remove = useMutation({
    mutationFn: () => deleteNoiseLocation({data: {locationId: location.id}}),
    onSuccess: async () => {
      // Closed first: the refetch takes the card — and so this dialog — away with it.
      onClose();
      await refresh();
      toaster.create({
        type: 'success',
        title: `${location.locationName} deleted`,
      });
    },
    onError: errorToast('Location could not be deleted'),
  });

  const parts = [
    count(
      location.assignments.length,
      'device assignment',
      'device assignments',
    ),
    count(location.limits.length, 'limit', 'limits'),
    ...(tags > 0 ? [count(tags, 'tag', 'tags')] : []),
  ];

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && !remove.isPending && onClose()}
      placement="center"
      role="alertdialog"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {location.locationName}?</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger disabled={remove.isPending} />
        <DialogBody>
          <Text>
            This also deletes its {listed(parts)}. The devices and what they
            recorded are not affected. This cannot be undone.
          </Text>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={remove.isPending}
          >
            Cancel
          </Button>
          <Button
            colorPalette="red"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
