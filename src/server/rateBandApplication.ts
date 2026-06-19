import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {prismaClient} from './prismaClient.server';

// Create/update (or clear) the viewer's own rating for a band application.
// crewAuth resolves the Slack-keyed Viewer onto context.viewer; ratings are
// keyed on that Viewer.id (the BandApplicationRating compound PK is
// [viewerId, bandApplicationId]).
export const rateBandApplication = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
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
    if (data.rating === 0) {
      // Clearing the rating: remove the row (deleteMany won't throw when absent).
      await prismaClient.bandApplicationRating.deleteMany({
        where: {viewerId, bandApplicationId: data.applicationId},
      });
    } else {
      await prismaClient.bandApplicationRating.upsert({
        where: {
          viewerId_bandApplicationId: {
            viewerId,
            bandApplicationId: data.applicationId,
          },
        },
        create: {
          viewerId,
          bandApplicationId: data.applicationId,
          rating: data.rating,
        },
        update: {rating: data.rating},
      });
    }
  });
