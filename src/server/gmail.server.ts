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
 * the legacy api uses (same SM secret names, too) — so this works as long
 * as domain-wide delegation stays configured for the kulturspektakel.de
 * Workspace.
 *
 * The `.replace(/\\n/g, '\n')` mirrors what legacy does — covers the case
 * where the PEM was stored with escaped newlines (e.g. some Vercel UI flows)
 * rather than literal ones.
 */
export async function gmailClient(
  account: string,
  scopes: string[] = ['https://www.googleapis.com/auth/gmail.readonly'],
): Promise<gmail_v1.Gmail> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n',
  );
  if (!email || !key) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not set',
    );
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes,
    subject: account,
  });
  await auth.authorize();
  return google.gmail({auth, version: 'v1'});
}

/**
 * Mailboxes we're allowed to send as via the Gmail API, each mapped to the
 * `From:` header used for its outgoing mail. The delegation grants send access
 * to every mailbox in the domain, but we deliberately gate it to a typed
 * allow-list — add an entry here to enable another account.
 */
const SEND_AS = {
  'booking@kulturspektakel.de':
    'Kulturspektakel Gauting Booking <booking@kulturspektakel.de>',
} as const;

export type SendAsAccount = keyof typeof SEND_AS;

/**
 * Send a plain-text email from one of our `@kulturspektakel.de` mailboxes via
 * the Gmail API, so it lands in that account's Sent folder (unlike SES, which
 * never touches the mailbox). Requires the `gmail.send` scope to be delegated
 * to the SA.
 */
export async function sendGmail({
  account,
  to,
  subject,
  text,
}: {
  account: SendAsAccount;
  to: string;
  subject: string;
  text: string;
}) {
  const from = SEND_AS[account];
  const gmail = await gmailClient(account, [
    'https://www.googleapis.com/auth/gmail.send',
  ]);
  // RFC 2822 message. Subject is RFC 2047-encoded and the body base64-encoded
  // so umlauts / en-dashes survive intact.
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
  ].join('\r\n');
  const raw = Buffer.from(
    `${headers}\r\n\r\n${Buffer.from(text).toString('base64')}`,
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // base64url
  await gmail.users.messages.send({userId: 'me', requestBody: {raw}});
}

/**
 * Archive a message — Gmail's "archive" is simply removing the `INBOX` label.
 * Requires the `gmail.modify` scope to be delegated to the SA (broader than the
 * default `gmail.readonly`).
 */
export async function archiveGmailMessage(account: string, messageId: string) {
  const gmail = await gmailClient(account, [
    'https://www.googleapis.com/auth/gmail.modify',
  ]);
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {removeLabelIds: ['INBOX']},
  });
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
 * Escape a string for safe interpolation into a Slack `mrkdwn` field. Per
 * Slack's guidance, escaping `&`, `<` and `>` is sufficient — it also defuses
 * mention/link injection (`<!channel>`, `<@U…>`, `<url|text>`), since all of
 * those require a literal `<`.
 */
function escapeSlack(value: string | null): string | null {
  return value
    ?.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;') ?? null;
}

/**
 * Format a Gmail message as a Slack message attachment. Uses Block Kit blocks
 * (rather than legacy attachment `actions`) so the "Archivieren" button arrives
 * as a `block_actions` interaction — see `slack/interaction.ts`.
 *
 * Once the mail has been archived, pass `archivedBy` (a Slack user id) to swap
 * the buttons for a "Archiviert von …" note when re-rendering the message.
 */
export function slackAttachment(
  message: gmail_v1.Schema$Message,
  account: string,
  {color, archivedBy}: {color?: string; archivedBy?: string} = {},
) {
  const url = `https://mail.google.com/mail/u/${account}/#inbox/${message.threadId}`;
  // The header/snippet values are attacker-controlled (they come straight from
  // the inbound email), so escape them per Slack's mrkdwn rules before we drop
  // them into a `mrkdwn` block. Escaping `<` neutralizes `<!channel>`, `<@U…>`,
  // and `<url|text>` link injection too.
  const from = escapeSlack(getHeaderField(message, 'from'));
  const subject = escapeSlack(getHeaderField(message, 'subject'));
  const snippet = escapeSlack(message.snippet ?? null);

  const footerBlock = archivedBy
    ? {
        type: 'context',
        elements: [
          {type: 'mrkdwn', text: `🗄️ Archiviert von <@${archivedBy}>`},
        ],
      }
    : {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {type: 'plain_text', text: 'Öffnen'},
            url,
          },
          {
            type: 'button',
            text: {type: 'plain_text', text: 'Archivieren'},
            action_id: 'archive-gmail',
            value: JSON.stringify({account, messageId: message.id}),
          },
        ],
      };

  return {
    fallback: url,
    color,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [from && `*${from}*`, subject && `*${subject}*`, snippet]
            .filter(Boolean)
            .join('\n'),
        },
      },
      footerBlock,
    ],
  };
}
