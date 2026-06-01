/**
 * Slack Web API helpers. Ported from `~/api.kulturspektakel.de/src/utils/slack.ts`.
 *
 * Today only `slackApiRequest` + `fetchUser` are used (by the nuclino-sso task
 * + viewer upsert). `sendMessage` and channel ids are kept for parity with the
 * legacy module — if those grow callers, expand the API surface here.
 */

export enum SlackChannel {
  dev = 'C93K75X61',
  bandbewerbungen = 'C3U99AB54',
  wiki = 'C03F5E07Z',
  booking = 'C3KKL3727',
  vorstand = 'G03HP9QM2',
  dj = 'C0491HCU5G9',
  lager = 'C03LJF6P36E',
  bookingmails = 'C06M4CM6D99',
  infomails = 'C08CGJ5BLAF',
  crewcards = 'C0965QS6763',
  zuschuesse = 'C030FV86XKR',
}

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
  | ({ok: false} & {error: string})
  | ({ok: true} & T);

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

export async function fetchUser(userId: string) {
  const res = await slackApiRequest<{user: SlackApiUser}>(
    `users.info?user=${userId}`,
  );
  if (!res.ok) {
    console.error('[slack] users.info failed', res);
    return undefined;
  }
  return res.user;
}
