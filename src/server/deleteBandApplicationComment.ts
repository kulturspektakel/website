import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {and, eq} from 'drizzle-orm';
import {bandApplicationComment} from './db/schema';
import {withTxid} from './withTxid.server';

// Delete one of your own comments on a band application.
// The viewerId in the where clause is the authorization check: a comment
// belonging to somebody else simply matches nothing.
export const deleteBandApplicationComment = createServerFn()
  .middleware([crewAuth])
  .validator(z.object({commentId: z.string()}))
  .handler(async ({data, context}) => {
    const viewerId = context.viewer?.id;
    if (!viewerId) {
      // null in dev (cookie never reaches localhost) or for a Directus account
      // with no Slack-keyed Viewer.
      throw new Error('Unauthorized');
    }
    return withTxid((tx) =>
      tx
        .delete(bandApplicationComment)
        .where(
          and(
            eq(bandApplicationComment.id, data.commentId),
            eq(bandApplicationComment.viewerId, viewerId),
          ),
        ),
    );
  });
