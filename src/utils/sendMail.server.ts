import {SESv2Client, SendEmailCommand} from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';

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
