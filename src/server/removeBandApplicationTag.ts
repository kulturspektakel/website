import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {withTxid} from './withTxid.server';

export const removeBandApplicationTag = createServerFn()
  .middleware([crewAuth])
  .validator(z.object({applicationId: z.string(), tag: z.string()}))
  .handler(async ({data, context}) => {
    if (!context.viewer?.id) {
      throw new Error('Unauthorized');
    }
    // deleteMany doesn't throw when the tag is already gone.
    return withTxid((tx) =>
      tx.bandApplicationTag.deleteMany({
        where: {bandApplicationId: data.applicationId, tag: data.tag},
      }),
    );
  });
