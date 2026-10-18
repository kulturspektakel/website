import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {bandApplicationComment} from './db/schema';
import {withTxid} from './withTxid.server';

// Post a comment on a band application. The client picks the id, so its
// optimistic comment and the one that comes back over Realtime share a key.
// crewAuth resolves the Slack-keyed Viewer onto context.viewer; comments are
// keyed on that Viewer.id.
export const postBandApplicationComment = createServerFn()
  .middleware([crewAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      applicationId: z.string(),
      comment: z.string().min(1).max(1000),
    }),
  )
  .handler(async ({data, context}) => {
    const viewerId = context.viewer?.id;
    if (!viewerId) {
      // null in dev (cookie never reaches localhost) or for a Directus account
      // with no Slack-keyed Viewer.
      throw new Error('Unauthorized');
    }
    return withTxid((tx) =>
      tx.insert(bandApplicationComment).values({
        id: data.id,
        viewerId,
        bandApplicationId: data.applicationId,
        comment: data.comment,
      }),
    );
  });
