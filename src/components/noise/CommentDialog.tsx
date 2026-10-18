import {useState} from 'react';
import {Button, Field, Input, Stack} from '@chakra-ui/react';
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
import {deleteNoiseTag, updateNoiseTag} from '../../routes/crew.noise';
import {errorToast} from '../toast';
import {TimeField} from './TimeField';
import {END_BEFORE_START} from './timeframe';
import {useProjectView} from './projectView';
import type {NoiseRangeTag} from './rangeTags';

// A comment, opened from its label on the chart: what it says and when, to edit, and the way
// to take it off. An empty end is "No end" — a marker at its start, as a comment with no end
// always is. Delete needs no second question — the dialog is already the comment's own, opened by
// pointing at it, and what is lost is a line of text the dialog is showing.
//
// Mounted per comment, so Cancel, the ✕ and a click outside all discard the draft by
// unmounting it.
export function CommentDialog({
  comment,
  onClose,
}: {
  comment: NoiseRangeTag;
  onClose: () => void;
}) {
  const {project, refresh} = useProjectView();
  const [text, setText] = useState(comment.text ?? '');
  const [start, setStart] = useState<number | null>(comment.start);
  const [end, setEnd] = useState<number | null>(comment.end);
  const trimmed = text.trim();
  // The start has no empty state of its own, but a cleared input reports one; it falls back
  // to where it was rather than to some other instant.
  const at = start ?? comment.start;
  const backwards = end != null && end <= at;
  const unchanged =
    trimmed === comment.text && at === comment.start && end === comment.end;

  const done = (title: string) => async () => {
    await refresh();
    toaster.create({type: 'success', title});
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      updateNoiseTag({
        data: {tagId: comment.id, text: trimmed, start: at, end},
      }),
    onSuccess: done('Comment saved'),
    onError: errorToast('Comment could not be saved'),
  });
  const remove = useMutation({
    mutationFn: () => deleteNoiseTag({data: {tagId: comment.id}}),
    onSuccess: done('Comment deleted'),
    onError: errorToast('Comment could not be deleted'),
  });
  const pending = save.isPending || remove.isPending;

  return (
    <DialogRoot
      open
      onOpenChange={(e) => !e.open && !pending && onClose()}
      placement="center"
    >
      {/* Wide enough for the two times side by side (see RangeTagDialog). */}
      <DialogContent maxW="34rem">
        <DialogHeader>
          <DialogTitle>Comment</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger disabled={pending} />
        <DialogBody>
          <Stack gap="4">
            <Field.Root required>
              <Field.Label>Comment</Field.Label>
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    trimmed &&
                    !backwards &&
                    !unchanged
                  ) {
                    save.mutate();
                  }
                }}
                maxLength={2000}
              />
            </Field.Root>
            {/* Side by side, as in the dialog a comment is made in (see RangeTagDialog). */}
            <Stack direction={{base: 'column', sm: 'row'}} gap="3">
              <Field.Root>
                <Field.Label>Start</Field.Label>
                <TimeField
                  label="Start"
                  value={start}
                  window={project}
                  onChange={setStart}
                />
              </Field.Root>
              <Field.Root invalid={backwards}>
                <Field.Label>End</Field.Label>
                <TimeField
                  label="End"
                  value={end}
                  window={project}
                  empty={{label: 'No end', at}}
                  onChange={setEnd}
                />
                {backwards && (
                  <Field.ErrorText>{END_BEFORE_START}</Field.ErrorText>
                )}
              </Field.Root>
            </Stack>
          </Stack>
        </DialogBody>
        <DialogFooter>
          {/* Apart from the other two, at the far end: the one that loses something. */}
          <Button
            variant="ghost"
            colorPalette="red"
            me="auto"
            loading={remove.isPending}
            disabled={save.isPending}
            onClick={() => remove.mutate()}
          >
            Delete
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={!trimmed || backwards || unchanged || remove.isPending}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
