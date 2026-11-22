import {beforeEach, describe, expect, test, vi} from 'vitest';

const {db, updates, inserts} = await vi.hoisted(async () =>
  (await import('../../../test/dbMock')).dbMock(),
);
const {fetchUser, sendMessage, conversationMembers} = vi.hoisted(() => ({
  fetchUser: vi.fn(),
  sendMessage: vi.fn(),
  conversationMembers: vi.fn(),
}));

vi.mock('../db.server', () => ({db}));
vi.mock('../slack.server', () => ({
  fetchUser,
  sendMessage,
  conversationMembers,
}));
vi.mock('../upsertViewer.server', () => ({
  upsertViewer: vi.fn().mockResolvedValue({id: 'U1'}),
}));
vi.mock('../appleWallet/pass.server', () => ({
  isAppleWalletConfigured: () => true,
}));

const {handleCrewCardCommand} = await import('./crewCard');

const command = () => {
  const body = new FormData();
  body.set('user_id', 'U1');
  return new Request('https://test/api/slack/crewcard', {method: 'POST', body});
};

const holder = {id: 'h1', viewerId: 'U1', pageToken: 'page-token'};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CONTACTLESS_SALT', 'salt');
  fetchUser.mockResolvedValue({id: 'U1'});
  sendMessage.mockResolvedValue(undefined);
  conversationMembers.mockResolvedValue([]);
  updates.mockResolvedValue([]);
});

describe('/crewcard', () => {
  test('a live wallet card gets a new link, nothing is issued', async () => {
    db.query.crewCardHolder.findFirst.mockResolvedValueOnce({
      ...holder,
      crewCards: [{id: 'card-1', validUntil: new Date('2030-01-01')}],
    });

    const {text} = await (await handleCrewCardCommand(command())).json();
    expect(text).toMatch(
      /<https:\/\/www\.kulturspektakel\.de\/crewcard\/page-token\?pass=[^|>]+\|Zu Apple Wallet hinzufügen>/,
    );
    expect(inserts).not.toHaveBeenCalled();
    expect(text).not.toContain('Wichtige Info');
    expect(updates).not.toHaveBeenCalled();
  });

  test('without a live, unexpired wallet card a new one is issued', async () => {
    // An expired card isn't returned (validUntil > now in the query).
    db.query.crewCardHolder.findFirst
      .mockResolvedValueOnce({...holder, crewCards: []})
      .mockResolvedValueOnce(holder);
    db.query.event.findFirst.mockResolvedValueOnce({
      id: 'kult',
      name: 'Kult',
      start: new Date(Date.now() + 100 * 86_400_000),
      end: new Date(Date.now() + 102 * 86_400_000),
    });
    // The expired live wallet card is replaced.
    updates.mockResolvedValueOnce([{id: 'old', cardType: 'APPLE_WALLET'}]);
    inserts.mockResolvedValueOnce([
      {
        id: 'card-2',
        serial: Buffer.from('A1000000000002', 'hex'),
        validUntil: new Date('2030-01-01'),
      },
    ]);

    const {text} = await (await handleCrewCardCommand(command())).json();
    expect(inserts).toHaveBeenCalledWith(
      'CrewCard',
      expect.objectContaining({cardType: 'APPLE_WALLET', holderId: 'h1'}),
    );
    // Only the holder's wallet card is suspended: holder + type in the filter.
    expect(updates).toHaveBeenCalledWith(
      'CrewCard',
      expect.objectContaining({suspendedReason: 'replaced'}),
      ['h1', 'APPLE_WALLET'],
    );
    expect(text).toContain('/crewcard/page-token?pass=');
    expect(text).toContain('Deine bisherige Wallet-CrewCard wurde deaktiviert');
    // The CrewCard info comes with a new pass, in Slack mrkdwn.
    expect(text).toContain('*Wichtige Info*\n');
    expect(text).toContain('*muss*');
  });
});
