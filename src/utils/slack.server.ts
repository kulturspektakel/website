/**
 * Slack Web API helpers. Today only `slackApiRequest` is used (by the
 * nuclino-sso task). Expand the API surface here as new callers appear.
 */

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
