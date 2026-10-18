import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {and, eq} from 'drizzle-orm';
import {bandApplicationRating} from './db/schema';
import {withTxid} from './withTxid.server';

// Create/update (or clear) the viewer's own rating for a band application.
// crewAuth resolves the Slack-keyed Viewer onto context.viewer; ratings are
// keyed on that Viewer.id (the BandApplicationRating compound PK is
// [viewerId, bandApplicationId]).
export const rateBandApplication = createServerFn()
  .middleware([crewAuth])
  .validator(
    z.object({
      applicationId: z.string(),
      rating: z.number().int().min(0).max(4),
    }),
  )
  .handler(async ({data, context}) => {
    const viewerId = context.viewer?.id;
    if (!viewerId) {
      // null in dev (cookie never reaches localhost) or for a Directus account
      // with no Slack-keyed Viewer.
      throw new Error('Unauthorized');
    }
    return withTxid(async (tx) => {
      if (data.rating === 0) {
        // Clearing the rating: remove the row (a no-op when there is none).
        await tx
          .delete(bandApplicationRating)
          .where(
            and(
              eq(bandApplicationRating.viewerId, viewerId),
              eq(bandApplicationRating.bandApplicationId, data.applicationId),
            ),
          );
        return;
      }
      await tx
        .insert(bandApplicationRating)
        .values({
          viewerId,
          bandApplicationId: data.applicationId,
          rating: data.rating,
        })
        .onConflictDoUpdate({
          target: [
            bandApplicationRating.viewerId,
            bandApplicationRating.bandApplicationId,
          ],
          set: {rating: data.rating},
        });
    });
  });
