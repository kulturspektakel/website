import {createHash} from 'node:crypto';

// What makes two tags the same tag: same kind, same project and scope, same stretch, same
// words. Two of them say nothing one doesn't, so the column this goes into is unique (see the
// schema) — which is what stops a double-clicked import or two people importing the same
// stage from writing a lineup twice, where a check in code could only race.
//
// A hash rather than the fields themselves: a plain unique index over the columns would treat
// every NULL scope or end as distinct (Postgres' rule, and Prisma cannot ask for the other
// one), so a comment with no device would never collide with its twin. Here a NULL is a
// value like any other. Hashed so a 2000-character comment still fits an index entry.
export function noiseTagDedupeKey(tag: {
  type: string;
  projectId: string;
  locationId: string | null;
  deviceId: string | null;
  start: Date;
  end: Date | null;
  text: string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        tag.type,
        tag.projectId,
        tag.locationId,
        tag.deviceId,
        tag.start.getTime(),
        tag.end?.getTime() ?? null,
        tag.text,
      ]),
    )
    .digest('hex');
}
