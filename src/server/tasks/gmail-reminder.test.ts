import {beforeEach, describe, expect, test, vi} from 'vitest';

const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));
const {gmailClient} = vi.hoisted(() => ({gmailClient: vi.fn()}));
const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {gmailReminders: {delete: vi.fn()}},
}));

const ACCOUNT = 'booking@kulturspektakel.de';
const MID = 'm1';

vi.mock('../../server/slack.server', () => ({slackApiRequest}));
vi.mock('../../server/prismaClient.server', () => ({prismaClient: prismaMock}));
vi.mock('../../server/gmail.server', () => ({
  gmailClient,
  GMAIL_REMINDERS: {
    [ACCOUNT]: {channel: 'C-TEST', reminderInDays: [3]},
  },
  parseInternalDate: () => new Date('2026-01-01T00:00:00Z'),
  slackAttachment: () => ({}),
}));

const {handleGmailReminder} = await import('./gmail-reminder');

function reminderRequest(account: string, messageId: string) {
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify({account, messageId}),
    headers: {'content-type': 'application/json'},
  });
}

function fakeGmail(opts: {
  message?: {labelIds?: string[]; threadId?: string} | null;
  threadLatestMessageId?: string;
} = {}) {
  return {
    users: {
      messages: {
        get: vi.fn().mockResolvedValue(opts.message ? {data: opts.message} : null),
      },
      threads: {
        get: vi.fn().mockResolvedValue({
          data: {
            messages: opts.threadLatestMessageId
              ? [{id: opts.threadLatestMessageId}]
              : [],
          },
        }),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Handler chains `.catch` on the delete; default to a resolved promise so
  // the call doesn't blow up on `undefined.catch`.
  prismaMock.gmailReminders.delete.mockResolvedValue({});
});

describe('handleGmailReminder', () => {
  test('happy path: still unanswered → posts reminder to Slack', async () => {
    gmailClient.mockResolvedValueOnce(
      fakeGmail({
        message: {labelIds: ['INBOX'], threadId: 't1'},
        threadLatestMessageId: MID,
      }),
    );

    const res = await handleGmailReminder(reminderRequest(ACCOUNT, MID));

    expect(res.status).toBe(204);
    expect(prismaMock.gmailReminders.delete).toHaveBeenCalledWith({
      where: {messageId: MID},
    });
    expect(slackApiRequest).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({
        channel: 'C-TEST',
        text: expect.stringContaining(`unbeantwortet im Posteingang von ${ACCOUNT}`),
      }),
    );
  });

  test('still cleans up GmailReminders row when account is unknown', async () => {
    const res = await handleGmailReminder(
      reminderRequest('unknown@example.test', MID),
    );
    expect(res.status).toBe(204);
    expect(prismaMock.gmailReminders.delete).toHaveBeenCalled();
    expect(gmailClient).not.toHaveBeenCalled();
    expect(slackApiRequest).not.toHaveBeenCalled();
  });

  test('message gone (Gmail get returns null) → 204, no Slack', async () => {
    gmailClient.mockResolvedValueOnce(fakeGmail({message: null}));
    const res = await handleGmailReminder(reminderRequest(ACCOUNT, MID));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
  });

  test('message no longer in INBOX → 204, no Slack', async () => {
    gmailClient.mockResolvedValueOnce(
      fakeGmail({message: {labelIds: ['IMPORTANT'], threadId: 't1'}}),
    );
    const res = await handleGmailReminder(reminderRequest(ACCOUNT, MID));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
  });

  test('someone replied (latest in thread != our messageId) → 204, no Slack', async () => {
    gmailClient.mockResolvedValueOnce(
      fakeGmail({
        message: {labelIds: ['INBOX'], threadId: 't1'},
        threadLatestMessageId: 'm2-newer-reply',
      }),
    );
    const res = await handleGmailReminder(reminderRequest(ACCOUNT, MID));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
  });
});
