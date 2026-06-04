import {differenceInDays} from 'date-fns';
import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {slackApiRequest} from '../../server/slack.server';
import {
  gmailClient,
  GMAIL_REMINDERS,
  parseInternalDate,
  slackAttachment,
} from '../../server/gmail.server';

/**
 * Delayed Cloud Task — fires N days after a new email arrived (see
 * `tasks.gmail-notification.ts`). If the message is still sitting unanswered
 * in INBOX as the last message in its thread, post a reminder to Slack.
 *
 * The `GmailReminders` row gets deleted unconditionally as a small dedup
 * cleanup — even if we decide not to remind, we don't want the row hanging
 * around indefinitely.
 */
export async function handleGmailReminder(request: Request): Promise<Response> {
  const {account, messageId} = await readJsonPayload<{
    account: string;
    messageId: string;
  }>(request);

  await prismaClient.gmailReminders
    .delete({where: {messageId}})
    .catch(() => null);

  const config = GMAIL_REMINDERS[account];
  if (!config) {
    return new Response(null, {status: 204});
  }

  const gmail = await gmailClient(account);
  const message = await gmail.users.messages
    .get({id: messageId, userId: account})
    .catch(() => null);

  if (
    !message?.data ||
    !message.data.threadId ||
    !message.data.labelIds?.includes('INBOX') ||
    message.data.labelIds.includes('SENT')
  ) {
    return new Response(null, {status: 204});
  }

  const thread = await gmail.users.threads.get({
    id: message.data.threadId,
    userId: account,
    format: 'full',
  });
  if (thread.data.messages?.at(-1)?.id !== messageId) {
    // Someone has since replied to the thread — no reminder needed.
    return new Response(null, {status: 204});
  }

  const age = differenceInDays(new Date(), parseInternalDate(message.data));
  await slackApiRequest('chat.postMessage', {
    channel: config.channel,
    text: `Folgende E-Mail ist seit ${age} Tag${age === 1 ? '' : 'en'} unbeantwortet im Posteingang von ${account}. Kann sie bitte jemand beantworten oder sie archivieren, wenn keine Antwort notwendig ist.`,
    attachments: [slackAttachment(message.data, account, 'warning')],
  });

  return new Response(null, {status: 204});
}
