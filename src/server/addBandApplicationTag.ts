import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {bandApplicationTag} from './db/schema';
import {withTxid} from './withTxid.server';

// Add a tag to an application (idempotent — the [bandApplicationId, tag] pair is
// unique, and `tag` is citext so case-insensitive). Attributed to the crew
// member via context.viewer.
export const addBandApplicationTag = createServerFn()
  .middleware([crewAuth])
  .validator(
    z.object({applicationId: z.string(), tag: z.string().trim().min(1)}),
  )
  .handler(async ({data, context}) => {
    const viewerId = context.viewer?.id;
    if (!viewerId) {
      throw new Error('Unauthorized');
    }
    return withTxid((tx) =>
      tx
        .insert(bandApplicationTag)
        .values({
          bandApplicationId: data.applicationId,
          tag: data.tag,
          createdByViewerId: viewerId,
        })
        // Already there, in any casing (citext unique key): nothing to do.
        .onConflictDoNothing(),
    );
  });
