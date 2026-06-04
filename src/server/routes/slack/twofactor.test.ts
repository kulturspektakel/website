import {beforeEach, describe, expect, test, vi} from 'vitest';

const {findMany} = vi.hoisted(() => ({findMany: vi.fn()}));
const {sendMessage} = vi.hoisted(() => ({sendMessage: vi.fn()}));

vi.mock('../../../utils/prismaClient.server', () => ({
  prismaClient: {twoFactor: {findMany}},
}));
vi.mock('../../../utils/slack.server', () => ({sendMessage}));

const {handleTwoFactorCommand} = await import('./twofactor');

// Standard RFC test base32 secret.
const SECRET = 'JBSWY3DPEHPK3PXP';

function command(text: string) {
  return new Request('https://test/slack/twofactor', {
    method: 'POST',
    body: new URLSearchParams({text, user_name: 'U1', token: 't'}),
    headers: {'content-type': 'application/x-www-form-urlencoded'},
  });
}

beforeEach(() => vi.clearAllMocks());

describe('handleTwoFactorCommand', () => {
  test('exact account match returns a code and announces in #dev', async () => {
    findMany.mockResolvedValueOnce([
      {account: 'kasse', service: 'PayPal', secret: SECRET},
    ]);
    const res = await handleTwoFactorCommand(command('kasse'));
    const body = await res.json();
    expect(body.text).toMatch(/2-Faktor-Code für kasse \(PayPal\): \d{6}/);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({channel: 'C93K75X61'}), // #dev
    );
  });

  test('no match returns the account picker', async () => {
    findMany.mockResolvedValueOnce([
      {account: 'kasse', service: 'PayPal', secret: SECRET},
      {account: 'instagram', service: 'Meta', secret: SECRET},
    ]);
    const res = await handleTwoFactorCommand(command('unknown'));
    const body = await res.json();
    expect(body.text).toContain('Für welchen Account');
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
