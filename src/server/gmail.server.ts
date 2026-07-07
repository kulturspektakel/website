import {gmail_v1, google} from 'googleapis';
import TurndownService from 'turndown';
import {slackifyMarkdown} from 'slackify-markdown';
import {ApiError} from './apiError.server';
import {slackApiRequest} from './slack.server';

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

/**
 * Extract a readable body from a Gmail message as Slack `mrkdwn`. Walks the MIME
 * tree and prefers the `text/plain` alternative (escaped, since Slack would
 * otherwise interpret literal `*`/`_`/`<…>` in the mail); falls back to
 * converting the `text/html` part to Slack mrkdwn when that's all the sender
 * provided. Returns `null` if no textual part is found.
 */
export function getMessageBody(
  message: gmail_v1.Schema$Message,
): {text: string; quoteStripped: boolean} | null {
  let plain: string | null = null;
  let html: string | null = null;

  const walk = (part?: gmail_v1.Schema$MessagePart) => {
    if (!part) return;
    const data = part.body?.data;
    if (data) {
      const decoded = Buffer.from(data, 'base64url').toString('utf-8');
      if (part.mimeType === 'text/plain' && plain === null) {
        plain = decoded;
      } else if (part.mimeType === 'text/html' && html === null) {
        html = decoded;
      }
    }
    part.parts?.forEach(walk);
  };
  walk(message.payload);

  if (plain !== null) {
    const {text, quoteStripped} = stripPlainTextQuote(plain);
    return {text: escapeSlack(text) ?? '', quoteStripped};
  }
  if (html !== null) return htmlToSlackMarkdown(html);
  return null;
}

/**
 * Drop the quoted reply history from a plain-text body — everything from the
 * first attribution line ("Am … schrieb:", "On … wrote:", Outlook markers) or
 * the first run of `>`-quoted lines onward. Keeps just the new message; the full
 * thread stays one click away in Gmail.
 */
function stripPlainTextQuote(text: string): {
  text: string;
  quoteStripped: boolean;
} {
  const attribution = [
    /^\s*Am\s.+\sschrieb.*:\s*$/, // German Gmail
    /^\s*On\s.+\swrote:\s*$/, // English Gmail
    /^\s*-{2,}\s*Original(?:\s|-)Message\s*-{2,}/i, // Outlook
    /^\s*Von:\s.+/, // Outlook (de) forwarded header
    /^_{5,}\s*$/, // Outlook divider
  ];
  const lines = text.split('\n');
  const cut = lines.findIndex(
    (l) => attribution.some((p) => p.test(l)) || /^\s*>/.test(l),
  );
  if (cut === -1) return {text, quoteStripped: false};
  return {text: lines.slice(0, cut).join('\n').trimEnd(), quoteStripped: true};
}

/**
 * Turndown configured for *basic* markdown only — bold, italic, links, lists,
 * headings, blockquotes, code. Images and figures are dropped (Slack mrkdwn
 * can't render them inline anyway and they'd just leave noisy alt-text/URLs).
 */
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});
turndown.remove(['figure', 'style', 'script', 'head']);
// `remove` doesn't drop void elements like <img>, so blank them with a rule.
turndown.addRule('noImages', {filter: ['img'], replacement: () => ''});

// Set by the quote-stripping rule below during a `turndown()` call. Safe as a
// module-level flag because `turndown()` runs synchronously (no interleaving).
let quoteWasStripped = false;
// Drop quoted reply history — Gmail wraps it in `.gmail_quote`/`.gmail_extra`,
// Apple Mail in `<blockquote type="cite">`. Class-targeted so genuine inline
// quotes in the new message survive.
turndown.addRule('stripQuotes', {
  filter: (node) => {
    const cls = node.getAttribute?.('class') ?? '';
    if (node.nodeName === 'BLOCKQUOTE') {
      return /gmail_quote/.test(cls) || node.getAttribute?.('type') === 'cite';
    }
    if (node.nodeName === 'DIV') return /gmail_quote|gmail_extra/.test(cls);
    return false;
  },
  replacement: () => {
    quoteWasStripped = true;
    return '';
  },
});

/**
 * HTML → Slack mrkdwn: first to CommonMark via Turndown, then to Slack's mrkdwn
 * flavour (`*bold*`, `_italic_`, `<url|text>`, `•` lists) via slackify-markdown.
 * Also reports whether quoted reply history was dropped.
 */
function htmlToSlackMarkdown(html: string): {
  text: string;
  quoteStripped: boolean;
} {
  quoteWasStripped = false;
  const text = slackifyMarkdown(turndown.turndown(html)).trim();
  return {text, quoteStripped: quoteWasStripped};
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
            text: {type: 'plain_text', text: 'Lesen'},
            action_id: 'show-gmail',
            value: JSON.stringify({account, messageId: message.id}),
          },
          {
            type: 'button',
            text: {type: 'plain_text', text: 'In GMail öffnen'},
            url,
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

// Slack limits: a section `plain_text` field caps at 3000 chars and a modal at
// 100 blocks. Chunk the body on line boundaries, staying under both.
const MAX_CHARS = 2900;
const MAX_BLOCKS = 90;

function chunkBody(body: string): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of body.split('\n')) {
    // A single line longer than the limit is hard-split.
    const pieces =
      line.length > MAX_CHARS
        ? (line.match(new RegExp(`.{1,${MAX_CHARS}}`, 'g')) ?? [line])
        : [line];
    for (const piece of pieces) {
      if (current.length + piece.length + 1 > MAX_CHARS) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Build the Block Kit view for the "read email" modal. `origin` is the channel
 * message the modal was opened from — stashed in `private_metadata` so the
 * in-modal "Archivieren" button can archive the mail and rewrite that message.
 */
function gmailModalView(
  message: gmail_v1.Schema$Message,
  account: string,
  origin: {channel: string; ts: string},
) {
  const url = `https://mail.google.com/mail/u/${account}/#inbox/${message.threadId}`;
  const subject = escapeSlack(getHeaderField(message, 'subject')) ?? '(kein Betreff)';
  const from = escapeSlack(getHeaderField(message, 'from')) ?? '';
  const parsed = getMessageBody(message);
  const body = parsed?.text || '(kein Textinhalt gefunden)';

  const allChunks = chunkBody(body);
  const chunks = allChunks.slice(0, MAX_BLOCKS);
  const truncated = allChunks.length > MAX_BLOCKS;

  const notes = [
    parsed?.quoteStripped && 'Zitierter Verlauf ausgeblendet.',
    truncated && 'E-Mail gekürzt.',
    (parsed?.quoteStripped || truncated) &&
      'Vollständig über „In GMail öffnen".',
  ].filter(Boolean) as string[];

  return {
    type: 'modal',
    callback_id: 'show-gmail',
    private_metadata: JSON.stringify({account, messageId: message.id, ...origin}),
    // Slack truncates modal titles at 24 chars.
    title: {type: 'plain_text', text: 'E-Mail'},
    close: {type: 'plain_text', text: 'Schließen'},
    blocks: [
      {type: 'section', text: {type: 'mrkdwn', text: `*${from}*\n*${subject}*`}},
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {type: 'plain_text', text: 'In GMail öffnen'},
            url,
          },
          {
            type: 'button',
            style: 'danger',
            text: {type: 'plain_text', text: 'Archivieren'},
            action_id: 'archive-gmail',
          },
        ],
      },
      {type: 'divider'},
      ...chunks.map((text) => ({
        type: 'section',
        text: {type: 'mrkdwn', text},
      })),
      ...(notes.length
        ? [
            {
              type: 'context',
              elements: [{type: 'mrkdwn', text: `_${notes.join(' ')}_`}],
            },
          ]
        : []),
    ],
  };
}

/**
 * Open the "read email" modal. Re-fetches the message from Gmail at click time
 * (rather than stuffing the body into the button's 2000-char value). Called from
 * the `show-gmail` block action; `origin` is the channel message it fired from.
 */
export async function showGmailModal(
  account: string,
  messageId: string,
  triggerId: string,
  origin: {channel: string; ts: string},
): Promise<void> {
  const gmail = await gmailClient(account);
  const {data: message} = await gmail.users.messages.get({
    id: messageId,
    userId: 'me',
  });

  const response = await slackApiRequest('views.open', {
    trigger_id: triggerId,
    view: gmailModalView(message, account, origin),
  });

  if (!response.ok) {
    throw new ApiError(502, 'views.open failed', new Error(response.error));
  }
}
