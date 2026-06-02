import type Mail from 'nodemailer/lib/mailer';
import mails from '../../maizzle/generated';
import {readJsonPayload} from '../../utils/readJsonPayload.server';
import {transport, type From} from '../../utils/sendMail.server';

type ExtraFields = Pick<Mail.Options, 'cc' | 'bcc' | 'replyTo'>;

type SendEmailTemplatePayload = ExtraFields & {
  from: From;
  to: NonNullable<Mail.Options['to']>;
  template: keyof typeof mails;
  variables: Record<string, string>;
};

type SendEmailRawPayload = ExtraFields & {
  from: From;
  to: NonNullable<Mail.Options['to']>;
  subject: string;
  text: string;
};

export type SendEmailPayload = SendEmailTemplatePayload | SendEmailRawPayload;

/**
 * Send a transactional email via SES. Two payload shapes:
 *   - `{template, variables}` — renders one of the Maizzle templates in
 *     `src/maizzle/generated/`.
 *   - `{subject, text}` — plain unformatted email (rare; mostly used for
 *     internal notifications).
 */
export async function handleSendEmail(request: Request): Promise<Response> {
  const data = await readJsonPayload<SendEmailPayload>(request);
  if ('template' in data) {
    const {template, variables, ...rest} = data;
    // The variables type is per-template; once we've discriminated on
    // `template` we'd need overloads for each one. Cast — the type safety
    // lives in `enqueueGcpTask('send-email', payload)` on the caller side.
    await transport.sendMail({
      ...mails[template](variables as never),
      ...rest,
    });
  } else {
    await transport.sendMail(data);
  }
  return new Response(null, {status: 204});
}
