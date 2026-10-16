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
import {deleteNoiseTag} from '../../routes/crew.noise';
import {instantLabel} from './chartUtils';
import {errorToast} from './toast';
import {useProjectView, type NoiseLocationItem} from './projectView';
import type {NoiseRangeTag} from './rangeTags';

const label = instantLabel(false);

// Taking an ignored range back, behind a question: what the ✕ on the chart's "Ignored"
// pill opens. The question names what the range applied to, because the pill stands on
// one card and the tag may be the whole event's — removing it here counts those readings
// again everywhere, not just on this chart.
//
// A comment is taken back through the same question, from the ✕ on its label — worded for
// what is lost, which there is the note rather than a stretch set aside.
//
// Mounted per tag, so Cancel, the ✕ and a click outside all simply unmount it.
export function RemoveTagDialog({
  tag,
  location,
  onClose,
}: {
  tag: NoiseRangeTag;
  location: NoiseLocationItem;
  onClose: () => void;
}) {
  const {project, refresh} = useProjectView();
  const comment = tag.type === 'COMMENT';
  const copy = comment
    ? {
        title: 'Delete comment?',
        action: 'Delete',
        done: 'Comment deleted',
        failed: 'Comment could not be deleted',
      }
    : {
        title: 'Un-ignore range?',
        action: 'Un-ignore',
        done: 'Range no longer ignored',
        failed: 'Range could not be un-ignored',
      };

  const remove = useMutation({
    mutationFn: () => deleteNoiseTag({data: {tagId: tag.id}}),
    onSuccess: async () => {
      await refresh();
      toaster.create({
        type: 'success',
        title: copy.done,
      });
      onClose();
    },
    onError: errorToast(copy.failed),
  });

  const scope =
    tag.deviceId != null
      ? `device ${tag.deviceId}`
      : tag.locationId != null
        ? `all devices at ${location.locationName}`
        : `everything in ${project.name}`;

  return (
    <DialogRoot
      open
      onOpenChange={(e) => !e.open && !remove.isPending && onClose()}
      placement="center"
      role="alertdialog"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger disabled={remove.isPending} />
        <DialogBody>
          {comment ? (
            <Text>
              “{tag.text}” on {scope}{' '}
              {tag.end == null
                ? `at ${label(tag.start)}`
                : `between ${label(tag.start)} and ${label(tag.end)}`}{' '}
              will be deleted.
            </Text>
          ) : (
            <Text>
              Readings from {scope} between {label(tag.start)} and{' '}
              {label(tag.end ?? tag.start)} will count again.
            </Text>
          )}
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
            {copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
