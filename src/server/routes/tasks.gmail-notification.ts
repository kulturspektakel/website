import {addDays, isBefore, subMinutes} from 'date-fns';
import {prismaClient} from '../../utils/prismaClient.server';
import {readJsonPayload} from '../../utils/readJsonPayload.server';
import {slackApiRequest} from '../../utils/slack.server';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';
import {
  gmailClient,
  GMAIL_REMINDERS,
  getHeaderField,
  slackAttachment,
} from '../../utils/gmail.server';

/**
 * Pub/Sub push target. The subscription delivers Gmail watch notifications
 * here — Pub/Sub wraps the notification in an envelope where `message.data`
 * is base64-encoded `{emailAddress, historyId}` (whatever Gmail published).
 *
 * Flow on a new inbound email:
 *   1. Pull the latest INBOX thread for the account.
 *   2. Skip if it's the SA's own sent/draft, from the account itself, or
 *      already deduped via the `GmailReminders` table.
 *   3. Send an immediate "new email" Slack notification.
 *   4. Insert into `GmailReminders` (unique on messageId — dedupes).
 *   5. Enqueue the delayed reminder task for `+reminderInDays`.
 */
export async function handleGmailNotification(
  request: Request,
): Promise<Response> {
  const envelope = await readJsonPayload<{message: {data?: string}}>(request);
  if (!envelope.message?.data) {
    return new Response(null, {status: 204});
  }
  const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf-8');
  const {emailAddress: account} = JSON.parse(decoded) as {
    emailAddress: string;
    historyId: number;
  };

  const config = GMAIL_REMINDERS[account];
  if (!config) {
    console.warn(`[gmail-notification] unknown account ${account}`);
    return new Response(null, {status: 204});
  }

  const gmail = await gmailClient(account);
  const {data} = await gmail.users.threads.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: 1,
  });

  const threadId = data.threads?.at(0)?.id;
  if (!threadId) {
    return new Response(null, {status: 204});
  }

  const thread = await gmail.users.threads.get({userId: 'me', id: threadId});
  const message = thread.data.messages?.at(-1);
  if (
    !message ||
    !message.id ||
    message.labelIds?.includes('SENT') ||
    message.labelIds?.includes('DRAFT') ||
    getHeaderField(message, 'from') === account
  ) {
    return new Response(null, {status: 204});
  }

  const existing = await prismaClient.gmailReminders.findUnique({
    where: {messageId: message.id},
  });
  if (
    existing ||
    (message.internalDate &&
      isBefore(
        new Date(parseInt(message.internalDate, 10)),
        subMinutes(new Date(), 5),
      ))
  ) {
    // Already seen, or message is too old (Gmail can replay historyId on
    // catch-up — only react to genuinely new arrivals).
    return new Response(null, {status: 204});
  }

  await Promise.allSettled([
    slackApiRequest('chat.postMessage', {
      channel: config.channel,
      text: `Neue E-Mail für ${account}`,
      attachments: [slackAttachment(message, account)],
    }),
    prismaClient.gmailReminders.create({
      data: {messageId: message.id, account},
    }),
    ...config.reminderInDays.map((days) =>
      enqueueGcpTask(
        'gmail-reminder',
        {account, messageId: message.id!},
        {scheduleAt: addDays(new Date(), days)},
      ),
    ),
  ]);

  return new Response(null, {status: 204});
}
