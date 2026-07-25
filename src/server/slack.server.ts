/**
 * Slack Web API helpers. `slackApiRequest` is the low-level wrapper; the
 * `sendMessage`/`fetchUser`/`unfurl` helpers cover the common calls.
 */
import {ApiError} from './apiError.server';
import {SlackChannel} from '../utils/slackChannels';

export type SlackApiUser = {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  profile: {
    real_name: string;
    display_name: string;
    email: string;
    image_192: string;
  };
};

export type SlackApiResponse<T> =
  | ({ok: true} & T)
  | {ok: false; error: string};

export async function slackApiRequest<T>(
  endpoint: string,
  body?: Object,
): Promise<SlackApiResponse<T>> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN is not set');
  }
  const res = await fetch(`https://slack.com/api/${endpoint}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      authorization: `Bearer ${token}`,
      'Content-type': 'application/json; charset=utf-8',
    },
  });
  return (await res.json()) as SlackApiResponse<T>;
}

export async function sendMessage(body: {
  channel: SlackChannel | string;
  text: string;
  username?: string;
  icon_emoji?: string;
  blocks?: Array<unknown>;
  attachments?: Array<unknown>;
  unfurl_links?: boolean;
}): Promise<void> {
  const res = await slackApiRequest('chat.postMessage', body);
  if (!res.ok) {
    throw new Error(res.error);
  }
}

export async function fetchUser(
  user: string,
): Promise<SlackApiUser | undefined> {
  const res = await slackApiRequest<{user: SlackApiUser}>(
    `users.info?user=${user}`,
  );
  if (!res.ok) {
    console.error(res);
    return;
  }
  return res.user;
}

/**
 * All member ids of a channel, following `conversations.members` cursor
 * pagination (Slack caps a page at 1000; we ask for 200). Bot users are
 * included, as Slack returns them.
 *
 * Requires `channels:read` for public channels, `groups:read` plus bot
 * membership for private ones.
 */
export async function conversationMembers(channel: string): Promise<string[]> {
  const members: string[] = [];
  let cursor: string | undefined;
  // Belt-and-braces bound on the cursor loop: 20 pages × 200 is far more
  // members than any of our channels has, so a cursor that never terminates
  // can't spin the function until it times out.
  for (let page = 0; page < 20; page++) {
    const res = await slackApiRequest<{
      members: string[];
      response_metadata?: {next_cursor?: string};
    }>(
      `conversations.members?channel=${channel}&limit=200${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      }`,
    );
    if (!res.ok) {
      throw new ApiError(
        502,
        `Slack conversations.members failed: ${res.error}`,
      );
    }
    members.push(...res.members);
    cursor = res.response_metadata?.next_cursor || undefined;
    if (!cursor) {
      return members;
    }
  }
  // Only reachable if the cap was hit with a cursor still pending, i.e. the
  // list is genuinely truncated — say so rather than silently returning a
  // partial membership.
  console.warn(
    `[conversationMembers] ${channel}: stopped after 20 pages, list truncated at ${members.length}`,
  );
  return members;
}

export async function unfurl(body: {
  channel: string;
  ts: string;
  unfurls: Record<string, unknown>;
}): Promise<void> {
  const res = await slackApiRequest('chat.unfurl', body);
  if (!res.ok) {
    console.error(res);
  }
}

/**
 * POSTs to a Slack interaction `response_url` (to update/delete the original
 * message). Awaited — a detached fetch can be cut off when the serverless
 * function returns — but the (unused) response body is not read.
 */
export async function postResponseUrl(
  url: string,
  body: unknown,
): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  }).catch(console.error);
}
