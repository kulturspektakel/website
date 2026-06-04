import {beforeEach, describe, expect, test, vi} from 'vitest';

const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));
const {enqueueGcpTask} = vi.hoisted(() => ({enqueueGcpTask: vi.fn()}));
const {gmailClient} = vi.hoisted(() => ({gmailClient: vi.fn()}));
const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {
    gmailReminders: {findUnique: vi.fn(), create: vi.fn()},
  },
}));

const ACCOUNT = 'booking@kulturspektakel.de';

vi.mock('../../server/slack.server', () => ({slackApiRequest}));
vi.mock('../../server/enqueueGcpTask.server', () => ({enqueueGcpTask}));
vi.mock('../../server/prismaClient.server', () => ({prismaClient: prismaMock}));
vi.mock('../../server/gmail.server', () => ({
  gmailClient,
  GMAIL_REMINDERS: {
    [ACCOUNT]: {channel: 'C-TEST', reminderInDays: [3]},
  },
  GMAIL_ACCOUNTS: [ACCOUNT],
  getHeaderField: () => null,
  slackAttachment: () => ({}),
}));

const {handleGmailNotification} = await import('./gmail-notification');

function pubSubPush(emailAddress: string | undefined) {
  const data = emailAddress
    ? Buffer.from(JSON.stringify({emailAddress, historyId: 1})).toString('base64')
    : undefined;
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify({message: data ? {data} : {}}),
    headers: {'content-type': 'application/json'},
  });
}

function fakeGmail(opts: {
  threads?: Array<{id: string}>;
  threadMessages?: Array<{
    id?: string;
    labelIds?: string[];
    internalDate?: string;
  }>;
} = {}) {
  return {
    users: {
      threads: {
        list: vi.fn().mockResolvedValue({data: {threads: opts.threads ?? []}}),
        get: vi
          .fn()
          .mockResolvedValue({data: {messages: opts.threadMessages ?? []}}),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleGmailNotification — happy path', () => {
  test('sends Slack notif, stores dedup row, and schedules +3d reminder', async () => {
    const recentMs = String(Date.now() - 60 * 1000); // 1 min ago
    gmailClient.mockResolvedValueOnce(
      fakeGmail({
        threads: [{id: 't1'}],
        threadMessages: [
          {id: 'm1', labelIds: ['INBOX'], internalDate: recentMs},
        ],
      }),
    );
    prismaMock.gmailReminders.findUnique.mockResolvedValueOnce(null);

    const res = await handleGmailNotification(pubSubPush(ACCOUNT));

    expect(res.status).toBe(204);
    expect(slackApiRequest).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({
        channel: 'C-TEST',
        text: `Neue E-Mail für ${ACCOUNT}`,
      }),
    );
    expect(prismaMock.gmailReminders.create).toHaveBeenCalledWith({
      data: {messageId: 'm1', account: ACCOUNT},
    });
    expect(enqueueGcpTask).toHaveBeenCalledWith(
      'gmail-reminder',
      {account: ACCOUNT, messageId: 'm1'},
      expect.objectContaining({scheduleAt: expect.any(Date)}),
    );
  });
});

describe('handleGmailNotification — early returns', () => {
  test('no data in envelope → 204, no Gmail call', async () => {
    const res = await handleGmailNotification(pubSubPush(undefined));
    expect(res.status).toBe(204);
    expect(gmailClient).not.toHaveBeenCalled();
    expect(slackApiRequest).not.toHaveBeenCalled();
  });

  test('unknown account → 204, no Gmail call', async () => {
    const res = await handleGmailNotification(
      pubSubPush('someone-else@elsewhere.com'),
    );
    expect(res.status).toBe(204);
    expect(gmailClient).not.toHaveBeenCalled();
  });

  test('no threads in INBOX → 204, no Slack', async () => {
    gmailClient.mockResolvedValueOnce(fakeGmail({threads: []}));
    const res = await handleGmailNotification(pubSubPush(ACCOUNT));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
  });

  test('latest message has SENT label → 204, no Slack', async () => {
    gmailClient.mockResolvedValueOnce(
      fakeGmail({
        threads: [{id: 't1'}],
        threadMessages: [{id: 'm1', labelIds: ['INBOX', 'SENT']}],
      }),
    );
    const res = await handleGmailNotification(pubSubPush(ACCOUNT));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
  });

  test('latest message has DRAFT label → 204, no Slack', async () => {
    gmailClient.mockResolvedValueOnce(
      fakeGmail({
        threads: [{id: 't1'}],
        threadMessages: [{id: 'm1', labelIds: ['DRAFT']}],
      }),
    );
    const res = await handleGmailNotification(pubSubPush(ACCOUNT));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
  });
});

describe('handleGmailNotification — dedup', () => {
  test('existing GmailReminders row → 204, no Slack', async () => {
    gmailClient.mockResolvedValueOnce(
      fakeGmail({
        threads: [{id: 't1'}],
        threadMessages: [{id: 'm1', labelIds: ['INBOX']}],
      }),
    );
    prismaMock.gmailReminders.findUnique.mockResolvedValueOnce({
      messageId: 'm1',
    });

    const res = await handleGmailNotification(pubSubPush(ACCOUNT));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
    expect(enqueueGcpTask).not.toHaveBeenCalled();
  });

  test('message older than 5 min (Gmail history replay) → 204, no Slack', async () => {
    const sixMinutesAgo = String(Date.now() - 6 * 60 * 1000);
    gmailClient.mockResolvedValueOnce(
      fakeGmail({
        threads: [{id: 't1'}],
        threadMessages: [
          {id: 'm1', labelIds: ['INBOX'], internalDate: sixMinutesAgo},
        ],
      }),
    );
    prismaMock.gmailReminders.findUnique.mockResolvedValueOnce(null);

    const res = await handleGmailNotification(pubSubPush(ACCOUNT));
    expect(res.status).toBe(204);
    expect(slackApiRequest).not.toHaveBeenCalled();
    expect(enqueueGcpTask).not.toHaveBeenCalled();
  });
});
