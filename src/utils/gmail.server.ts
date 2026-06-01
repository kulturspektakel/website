import {gmail_v1, google} from 'googleapis';

/**
 * Slack channels that receive new-mail + reminder pings, keyed by the Gmail
 * inbox they correspond to. Stays the same as the legacy config in
 * `~/api.kulturspektakel.de/src/tasks/gmailReminder.ts`.
 */
export const GMAIL_REMINDERS: Record<
  string,
  {channel: string; reminderInDays: number[]}
> = {
  'booking@kulturspektakel.de': {
    channel: 'C06M4CM6D99', // bookingmails
    reminderInDays: [3],
  },
  'info@kulturspektakel.de': {
    channel: 'C08CGJ5BLAF', // infomails
    reminderInDays: [3],
  },
  'lager@kulturspektakel.de': {
    channel: 'C03LJF6P36E', // lager
    reminderInDays: [3],
  },
};

export const GMAIL_ACCOUNTS = Object.keys(GMAIL_REMINDERS);

/**
 * An authenticated Gmail v1 client that impersonates `account` via the
 * Workspace-delegated service account. Both env vars come from the existing
 * `gmail-reminder@gmail-reminder-api.iam.gserviceaccount.com` SA — same one
 * the legacy api uses — so this works as long as domain-wide delegation
 * stays configured for the kulturspektakel.de Workspace.
 *
 * The `.replace(/\\n/g, '\n')` mirrors what legacy does — covers the case
 * where the PEM was stored with escaped newlines (e.g. some Vercel UI flows)
 * rather than literal ones.
 */
export async function gmailClient(account: string): Promise<gmail_v1.Gmail> {
  const email = process.env.GMAIL_SA_EMAIL;
  const key = process.env.GMAIL_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('GMAIL_SA_EMAIL / GMAIL_SA_PRIVATE_KEY not set');
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    subject: account,
  });
  await auth.authorize();
  return google.gmail({auth, version: 'v1'});
}

export function getHeaderField(message: gmail_v1.Schema$Message, field: string) {
  const header = message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === field.toLowerCase(),
  );
  return header?.value ?? null;
}

export function parseInternalDate(message: gmail_v1.Schema$Message): Date {
  return new Date(parseInt(message.internalDate ?? '0', 10));
}

/**
 * Format a Gmail message as a Slack message attachment with an "Open" link
 * back to the message in the inbox.
 */
export function slackAttachment(
  message: gmail_v1.Schema$Message,
  account: string,
  color?: string,
) {
  const url = `https://mail.google.com/mail/u/${account}/#inbox/${message.threadId}`;
  return {
    author_name: getHeaderField(message, 'from'),
    callback_id: message.threadId,
    fallback: url,
    title: getHeaderField(message, 'subject'),
    text: message.snippet,
    color,
    ts: Math.round(parseInternalDate(message).getTime() / 1000),
    actions: [{type: 'button', text: 'Öffnen', url}],
  };
}
