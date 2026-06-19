import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {prismaClient} from './prismaClient.server';

// Post a comment on a band application.
// crewAuth resolves the Slack-keyed Viewer onto context.viewer; comments are
// keyed on that Viewer.id.
export const postBandApplicationComment = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({
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
    await prismaClient.bandApplicationComment.create({
      data: {
        viewerId,
        bandApplicationId: data.applicationId,
        comment: data.comment,
      },
    });
  });
