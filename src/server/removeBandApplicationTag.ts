import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {and, eq} from 'drizzle-orm';
import {bandApplicationTag} from './db/schema';
import {withTxid} from './withTxid.server';

export const removeBandApplicationTag = createServerFn()
  .middleware([crewAuth])
  .validator(z.object({applicationId: z.string(), tag: z.string()}))
  .handler(async ({data, context}) => {
    if (!context.viewer?.id) {
      throw new Error('Unauthorized');
    }
    // deleteMany doesn't throw when the tag is already gone.
    // `tag` is citext, so this matches whatever casing it was stored in.
    return withTxid((tx) =>
      tx
        .delete(bandApplicationTag)
        .where(
          and(
            eq(bandApplicationTag.bandApplicationId, data.applicationId),
            eq(bandApplicationTag.tag, data.tag),
          ),
        ),
    );
  });
