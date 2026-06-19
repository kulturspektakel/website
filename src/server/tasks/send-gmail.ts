import {readJsonPayload} from '../../server/readJsonPayload.server';
import {sendGmail, type SendAsAccount} from '../../server/gmail.server';

export type SendGmailPayload = {
  account: SendAsAccount;
  to: string;
  subject: string;
  text: string;
};

/**
 * Send a plain-text email via the Gmail API (impersonating one of our
 * mailboxes) so it appears in that account's Sent folder.
 */
export async function handleSendGmail(request: Request): Promise<Response> {
  const data = await readJsonPayload<SendGmailPayload>(request);
  await sendGmail(data);
  return new Response(null, {status: 204});
}
