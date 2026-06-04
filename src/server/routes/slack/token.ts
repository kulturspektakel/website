import {addMinutes} from 'date-fns';
import {prismaClient} from '../../../utils/prismaClient.server';
import {ApiError} from '../../../utils/apiError.server';
import {fetchUser, slackApiRequest} from '../../../utils/slack.server';
import {upsertViewer} from '../../../utils/upsertViewer.server';
import {enqueueGcpTask} from '../../../utils/enqueueGcpTask.server';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/{token.ts,
 * ../../utils/nuclinoTokenGeneration.ts}`.
 *
 * The `/nuclino` slash command: a one-click Slack → Nuclino login. POST opens a
 * modal whose button links to GET /slack/token?nonce=…&redirect=…, which sets
 * the one-time `nonce` cookie (consumed by `nuclino-sso.ts` beforeLoad) and
 * redirects through Nuclino's SSO into our SAML IdP.
 */
const NONCE_LIFETIME_MINUTES = 5;

async function createNonce(createdForId: string): Promise<string> {
  const expiresAt = addMinutes(new Date(), NONCE_LIFETIME_MINUTES);
  const {nonce} = await prismaClient.nonce.create({
    data: {expiresAt, createdForId},
  });
  await enqueueGcpTask('nonce-invalidate', {nonce}, {scheduleAt: expiresAt});
  return nonce;
}

/** POST: `/nuclino` slash command → opens the login modal. */
export async function handleNuclinoTokenCommand(
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const userId = String(form.get('user_id') ?? '');
  const triggerId = String(form.get('trigger_id') ?? '');

  const slackUser = await fetchUser(userId);
  if (!slackUser) {
    throw new ApiError(400, 'Slack user not found');
  }
  const viewer = await upsertViewer(slackUser);
  const nonce = await createNonce(viewer.id);

  const nuclinoSsoUrl = new URL(
    `https://api.nuclino.com/api/sso/${process.env.NUCLINO_TEAM_ID}/login`,
  );
  nuclinoSsoUrl.searchParams.append(
    'redirectUrl',
    'https://app.nuclino.com/Kulturspektakel/General',
  );
  const url = new URL(`${process.env.SITE_URL}/api/slack/token`);
  url.searchParams.append('nonce', nonce);
  url.searchParams.append('redirect', nuclinoSsoUrl.toString());

  const response = await slackApiRequest('views.open', {
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'nuclino-login',
      title: {type: 'plain_text', text: 'Nuclino Login'},
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Falls du nicht bei Nuclino eingeloggt bist, klicke auf den Button um dich einzuloggen.',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Einloggen und Nuclino öffnen',
                emoji: true,
              },
              url: url.toString(),
              value: url.toString(),
              action_id: 'nuclino-login-open',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'plain_text',
              text: 'Der Button funktioniert nur einmalig und 5 Minuten lang. Danach muss der Dialog geschlossen und erneut geöffnet werden.',
              emoji: true,
            },
          ],
        },
      ],
    },
  });

  if (!response.ok) {
    throw new ApiError(502, 'views.open failed', new Error(response.error));
  }
  return new Response(null, {status: 200});
}

/** GET: the modal button target — set the nonce cookie, redirect into Nuclino SSO. */
export function handleNuclinoTokenRedirect(request: Request): Response {
  const query = new URL(request.url).searchParams;
  const nonce = query.get('nonce');
  const redirect = query.get('redirect');
  if (!nonce || !redirect) {
    throw new ApiError(400, 'Missing nonce or redirect');
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: redirect,
      // Read by nuclino-sso.ts beforeLoad. Domain-scoped so it's readable across
      // *.kulturspektakel.de; SameSite=None (set during a cross-site SSO hop).
      'set-cookie': `nonce=${nonce}; HttpOnly; Secure; SameSite=None; Max-Age=${NONCE_LIFETIME_MINUTES * 60}; Domain=.kulturspektakel.de; Path=/`,
    },
  });
}
