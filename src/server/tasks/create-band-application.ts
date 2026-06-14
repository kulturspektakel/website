import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {enqueueGcpTask} from '../../server/enqueueGcpTask.server';
import {slackApiRequest} from '../../server/slack.server';
import {ApiError} from '../../server/apiError.server';
import {SlackChannel} from '../../utils/slackChannels';

export type CreateBandApplicationPayload = {id: string};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/createBandApplication.ts`.
 * Triggered after a band application is created: sends the confirmation email,
 * announces it on Slack, and fans out the enrichment tasks (distance, demo,
 * and — where the applicant provided links — facebook/instagram/spotify).
 */
export async function handleCreateBandApplication(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<CreateBandApplicationPayload>(request);

  const application = await prismaClient.bandApplication.findUniqueOrThrow({
    where: {id},
    include: {event: true},
  });

  const eventYear = application.event.start.getFullYear();
  const isDJ = application.genreCategory === 'DJ';

  const work: Array<Promise<unknown>> = [
    enqueueGcpTask('send-email', {
      template: 'confirmBandApplication',
      variables: {
        bandname: application.bandname,
        eventYear: String(eventYear),
      },
      to: application.email,
      from: isDJ
        ? 'Kulturspektakel Gauting <info@kulturspektakel.de>'
        : 'Kulturspektakel Gauting Booking <booking@kulturspektakel.de>',
    }),
    enqueueGcpTask('band-application-distance', {id: application.id}),
    postSlackAnnouncement(application, isDJ),
  ];

  if (application.demo) {
    work.push(enqueueGcpTask('band-application-demo', {id: application.id}));
  }
  if (application.facebook) {
    work.push(enqueueGcpTask('facebook-likes', {id: application.id}));
  }
  if (application.instagram) {
    work.push(enqueueGcpTask('instagram-follower', {id: application.id}));
  }
  if (application.spotifyArtist) {
    work.push(enqueueGcpTask('spotify-listeners', {id: application.id}));
    work.push(enqueueGcpTask('spotify-image', {id: application.id}));
  }

  await Promise.all(work);

  return new Response(null, {status: 204});
}

async function postSlackAnnouncement(
  application: {
    bandname: string;
    demo: string | null;
    genre: string | null;
    genreCategory: string;
    city: string;
    contactName: string;
    contactPhone: string;
    email: string;
  },
  isDJ: boolean,
) {
  const res = await slackApiRequest('chat.postMessage', {
    channel: isDJ ? SlackChannel.dj : SlackChannel.bandbewerbungen,
    text: `Bewerbung von „${application.bandname}“`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: application.demo
            ? '*<' + application.demo + '|' + application.bandname + '>*'
            : `*${application.bandname}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Genre:*\n${application.genre ?? application.genreCategory}`,
          },
          {type: 'mrkdwn', text: `*Ort:*\n${application.city}`},
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*AnsprechpartnerIn:* ${application.contactName} (${application.contactPhone}) ${application.email}`,
          },
        ],
      },
      {type: 'divider'},
    ],
  });
  if (!res.ok) {
    throw new ApiError(
      502,
      'Slack chat.postMessage failed',
      new Error(JSON.stringify(res)),
    );
  }
}
