// One-off: fill NoiseTag.dedupeKey for every tag written before the column existed (see
// noiseTagDedupeKey). Run after the column has been pushed, and before it is made required.
//
// Exact duplicates cannot both take the same key under the unique index, so they are listed
// first and nothing is written while any remain. `--delete-duplicates` removes all but the
// oldest of each set, and then fills the keys.
//
//   yarn tsx scripts/backfillNoiseTagDedupeKey.ts [--delete-duplicates]
import 'dotenv/config';
import {asc, eq, inArray} from 'drizzle-orm';
import {db} from '../src/server/db.server';
import {noiseTag} from '../src/server/db/schema';
import {noiseTagDedupeKey} from '../src/server/noiseTagKey.server';

async function main() {
  const deleteDuplicates = process.argv.includes('--delete-duplicates');
  const tags = await db.query.noiseTag.findMany({
    orderBy: asc(noiseTag.createdAt),
  });

  const byKey = new Map<string, typeof tags>();
  for (const tag of tags) {
    const key = noiseTagDedupeKey(tag);
    byKey.set(key, [...(byKey.get(key) ?? []), tag]);
  }
  const duplicates = [...byKey.values()].filter((group) => group.length > 1);

  console.log(`${tags.length} tags, ${byKey.size} distinct.`);
  for (const [kept, ...extra] of duplicates) {
    console.log(
      `duplicate ${kept!.type} "${kept!.text ?? ''}" ${kept!.start.toISOString()}: keep ${kept!.id}, extra ${extra.map((t) => t.id).join(', ')}`,
    );
  }
  if (duplicates.length > 0 && !deleteDuplicates) {
    console.log(
      'Duplicates found; nothing written. Re-run with --delete-duplicates to keep the oldest of each.',
    );
    process.exitCode = 1;
    return;
  }

  const extraIds = duplicates.flatMap(([, ...extra]) => extra.map((t) => t.id));
  const updates = [...byKey.entries()]
    .map(([key, [kept]]) => ({id: kept!.id, key, current: kept!.dedupeKey}))
    .filter(({key, current}) => key !== current);

  await db.transaction(async (tx) => {
    if (extraIds.length) {
      await tx.delete(noiseTag).where(inArray(noiseTag.id, extraIds));
    }
    for (const {id, key} of updates) {
      await tx
        .update(noiseTag)
        .set({dedupeKey: key})
        .where(eq(noiseTag.id, id));
    }
  });
  console.log(
    `Deleted ${extraIds.length} duplicates, set ${updates.length} keys.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
