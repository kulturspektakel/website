import {item, user} from '../nuclino.server';
import {unfurl} from '../slack.server';
import type {SlackApiUser} from '../slack.server';
import {addToMailingList} from '../addToMailingList.server';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/events.ts` (+ the
 * legacy `unfurlLink` task, inlined here).
 *
 * Slack Events API webhook: the `url_verification` handshake, `link_shared`
 * Nuclino link unfurling, and `team_join` → mailing-list auto-add.
 */
type SlackEventBody =
  | {type: 'url_verification'; challenge: string}
  | {
      type: 'event_callback';
      event:
        | {
            type: 'link_shared';
            channel?: string;
            message_ts?: string;
            links: Array<{domain: string; url: string}>;
          }
        | {type: 'team_join'; user: SlackApiUser};
    };

export async function handleSlackEvents(request: Request): Promise<Response> {
  const body = (await request.json()) as SlackEventBody;

  switch (body.type) {
    case 'url_verification':
      return Response.json({challenge: body.challenge});
    case 'event_callback': {
      switch (body.event.type) {
        case 'link_shared': {
          await unfurlLinks(
            body.event.links,
            body.event.channel ?? '',
            body.event.message_ts ?? '',
          );
          return new Response(null, {status: 200});
        }
        case 'team_join': {
          await addToMailingList(body.event.user.profile.email);
          return new Response(null, {status: 200});
        }
      }
    }
  }
  return new Response(null, {status: 200});
}

async function unfurlLinks(
  links: Array<{domain: string; url: string}>,
  channel: string,
  ts: string,
) {
  const resolved = await Promise.all(
    links.map(async ({domain, url}) => {
      if (domain === 'app.nuclino.com') {
        const blocks = await unfurlNuclinoLink(url);
        if (blocks) return {url, blocks};
      }
      return undefined;
    }),
  );

  const unfurls: Record<string, unknown> = {};
  for (const r of resolved) {
    if (r) {
      unfurls[r.url] = r.blocks;
    }
  }

  if (Object.keys(unfurls).length > 0) {
    await unfurl({channel, ts, unfurls});
  }
}

async function unfurlNuclinoLink(url: string) {
  const match = url.match(
    /https:\/\/app\.nuclino\.com\/([^\/]+)\/([^\/]+)\/.*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
  );
  if (!match || match.length !== 4) {
    return;
  }

  const nuclinoItem = await item(match[3]);
  const updateAuthor = await user(nuclinoItem.lastUpdatedUserId);
  const content = nuclinoItem.content
    .split('\n')
    .slice(0, 2)
    .join('\n')
    .substring(0, 150);
  const pageUrl = `https://app.nuclino.com/Kulturspektakel/${match[2]}/${match[3]}`;

  return {
    blocks: [
      {
        type: 'header',
        text: {type: 'plain_text', text: nuclinoItem.title, emoji: true},
      },
      {type: 'section', text: {type: 'mrkdwn', text: content}},
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: `aktualisiert von ${updateAuthor.firstName} ${updateAuthor.lastName} am ${new Date(
              nuclinoItem.lastUpdatedAt,
            ).toLocaleString('de-DE')}`,
            emoji: true,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {type: 'plain_text', text: 'Öffnen', emoji: true},
            url: pageUrl,
            action_id: 'nuclino-link-open',
          },
        ],
      },
    ],
  };
}
