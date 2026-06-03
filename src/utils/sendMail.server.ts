import {SESv2Client, SendEmailCommand} from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import mails from '../../maizzle/generated';

const sesClient = new SESv2Client({
  apiVersion: '2010-12-01',
  region: 'eu-west-2',
});

export const transport = nodemailer.createTransport({
  SES: {sesClient, SendEmailCommand},
});

/**
 * Verified `From` addresses on our SES account. Adding a new address requires
 * verifying it in SES first; that's why this is a fixed union rather than an
 * arbitrary string.
 */
export type From =
  | 'Kulturspektakel Gauting Booking <booking@kulturspektakel.de>'
  | 'Kulturspektakel Gauting <info@kulturspektakel.de>'
  | 'Förderverein Kulturspektakel Gauting <foerderverein@kulturspektakel.de>'
  | 'Kulturspektakel Gauting Kasse <kasse@kulturspektakel.de>';

/**
 * Render a maizzle template and send via SES in one call. Used by the
 * one-off ops scripts in `scripts/` (e.g. donations, bandLineup). The
 * background `send-email` Cloud Task uses `transport.sendMail` directly
 * since it dispatches arbitrary payloads, not a fixed template per call.
 */
export function sendMail<T extends keyof typeof mails>(
  mail: T,
  from: From,
  variables: Parameters<(typeof mails)[T]>[0],
  data: Omit<Mail.Options, 'from' | 'subject' | 'text' | 'html'>,
) {
  return transport.sendMail({
    from,
    ...mails[mail](variables as never),
    ...data,
  });
}
