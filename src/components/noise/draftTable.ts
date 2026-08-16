// The save protocol both editors behind a location's ⋮ are built on: a table of rows read
// once when the dialog opened, edited locally, and written in one press.
//
// Its own module because the placements dialog and the limits dialog are the same machine
// with different columns — the same diff against the pinned original, the same "only the
// rows that moved" rule, the same ordering of the writes. Two copies of that agreed with
// each other only for as long as nobody touched one of them, and the failure is silent
// either way: a Save button that offers a save that turns out to be nothing, or a save that
// skips a row the button counted.
//
// Nothing here knows what a row *is*. Each dialog supplies its own comparison and its own
// three mutations, which is the whole of what differs between them.

// A row as it came back from the server, identified by the id it was stored under.
type Saved = {id: string};

// A row on screen: the one it came from, or null for one added in the dialog and not yet
// written anywhere.
type Draft = {id: string | null};

/**
 * Whether the table still says what the server has.
 *
 * One definition, asked by both the Save button (is there anything to save at all) and the
 * save itself (which rows need a write) — so the button can't offer a save that turns out
 * to be nothing, and the save can't skip a row the button counted.
 *
 * A different number of rows is an edit whatever the rows say: something was added or
 * binned. Past that, a row is an edit if it is new (`!was`) or if it has moved.
 */
export function hasEdits<D extends Draft, S extends Saved>(
  original: readonly S[],
  rows: readonly D[],
  isUnchanged: (row: D, was: S) => boolean,
): boolean {
  if (rows.length !== original.length) return true;
  return rows.some((row) => {
    const was = original.find((o) => o.id === row.id);
    return !was || !isUnchanged(row, was);
  });
}

/**
 * The whole table in one press: what was binned is deleted, what was changed is updated,
 * what was added is created.
 *
 * Sequential rather than in parallel, so a rejected write stops the rest — half a
 * correction applied is worse than none of it, and the dialog stays open on what the user
 * typed either way.
 *
 * Only the rows that actually moved are written: changing one of a location's five limits
 * is one request, not five. `isUnchanged` is the same test the Save button asked (see
 * hasEdits), so the two cannot disagree about what an edit is.
 *
 * `create` and `update` may decline by returning nothing, which is how a dialog keeps a row
 * its own rules refuse to write out of the wire without this having to know what makes one
 * unwritable.
 */
export async function applyEdits<D extends Draft, S extends Saved>(
  original: readonly S[],
  rows: readonly D[],
  {
    isUnchanged,
    create,
    update,
    remove,
  }: {
    isUnchanged: (row: D, was: S) => boolean;
    create: (row: D) => Promise<unknown> | void;
    // The id separately, because narrowing it off the row is this function's business
    // rather than every caller's.
    update: (row: D, id: string) => Promise<unknown> | void;
    remove: (was: S) => Promise<unknown>;
  },
): Promise<void> {
  const kept = new Set(rows.map((r) => r.id));
  for (const was of original) {
    if (!kept.has(was.id)) await remove(was);
  }
  for (const row of rows) {
    if (row.id == null) {
      await create(row);
      continue;
    }
    const was = original.find((o) => o.id === row.id);
    if (was && isUnchanged(row, was)) continue;
    await update(row, row.id);
  }
}
