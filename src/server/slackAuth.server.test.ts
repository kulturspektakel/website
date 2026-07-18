import {beforeEach, describe, expect, test, vi} from 'vitest';
import {slackSignature, verifySlackRequest} from './slackAuth.server';

const SECRET = 'test-signing-secret';
const BODY = 'token=x&user_id=U1&text=hello';

function request(headers: Record<string, string>) {
  return new Request('https://www.kulturspektakel.de/api/slack/owntracks', {
    method: 'POST',
    body: BODY,
    headers: {'content-type': 'application/x-www-form-urlencoded', ...headers},
  });
}

/** A header set with a valid signature for `ts` seconds. */
function signed(ts: number) {
  const timestamp = String(ts);
  return {
    'X-Slack-Request-Timestamp': timestamp,
    'X-Slack-Signature': slackSignature(timestamp, BODY, SECRET),
  };
}

beforeEach(() => {
  process.env.SLACK_SIGNING_SECRET = SECRET;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Freeze time so timestamp-skew checks are deterministic.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-19T12:00:00Z'));
});

const NOW = Math.floor(new Date('2026-07-19T12:00:00Z').getTime() / 1000);

describe('verifySlackRequest', () => {
  test('accepts a fresh, correctly-signed request', async () => {
    expect(await verifySlackRequest(request(signed(NOW)))).toBe(true);
  });

  test('leaves the body readable for the handler (verifies on a clone)', async () => {
    const req = request(signed(NOW));
    expect(await verifySlackRequest(req)).toBe(true);
    expect(await req.text()).toBe(BODY);
  });

  test('rejects a tampered body', async () => {
    const req = new Request('https://www.kulturspektakel.de/api/slack/owntracks', {
      method: 'POST',
      body: 'token=x&user_id=U1&text=<@U999>',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...signed(NOW),
      },
    });
    expect(await verifySlackRequest(req)).toBe(false);
  });

  test('rejects a stale timestamp (replay)', async () => {
    expect(await verifySlackRequest(request(signed(NOW - 60 * 6)))).toBe(false);
  });

  test('rejects missing signature headers', async () => {
    expect(await verifySlackRequest(request({}))).toBe(false);
  });

  test('rejects when the signing secret is unset', async () => {
    delete (process.env as Partial<NodeJS.ProcessEnv>).SLACK_SIGNING_SECRET;
    expect(await verifySlackRequest(request(signed(NOW)))).toBe(false);
  });
});
