import {TOTP} from 'otpauth';
import {prismaClient} from '../../../utils/prismaClient.server';
import {sendMessage} from '../../../utils/slack.server';
import {SlackChannel} from '../../../utils/slackChannels';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/twofactor.ts`.
 *
 * The `/2fa` slash command: generates a TOTP code for a shared Kult account
 * (stored in the `TwoFactor` table). With an exact account match it returns the
 * code directly; otherwise it returns a picker. `generateTwoFactorCodeResponse`
 * is also reused by the interaction handler's `two-factor-code` button.
 */
export async function generateTwoFactorCodeResponse(
  userId: string,
  {
    secret,
    account,
    service,
  }: {
    secret: string;
    account: string;
    service: string;
  },
) {
  const otp = new TOTP({secret}).generate();

  await sendMessage({
    channel: SlackChannel.dev,
    text: `<@${userId}> hat einen 2-Faktor-Code für ${account} (${service}) generiert.`,
  });

  return {
    text: `2-Faktor-Code für ${account} (${service}): ${otp}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `2-Faktor-Code für *${account}* (${service}): \`${otp}\``,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'Der Code ist für 30 Sekunden gültig.',
            emoji: true,
          },
        ],
      },
    ],
  };
}

export async function handleTwoFactorCommand(
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const text = String(form.get('text') ?? '');
  const userName = String(form.get('user_name') ?? '');

  const accounts = await prismaClient.twoFactor.findMany();
  const matchingAccounts = accounts.filter(
    (a) => a.account.toLowerCase() === text.trim().toLowerCase(),
  );

  if (matchingAccounts.length === 1) {
    return Response.json(
      await generateTwoFactorCodeResponse(userName, matchingAccounts[0]),
    );
  }

  return Response.json({
    text: 'Für welchen Account möchtest du einen 2-Faktor-Code generieren?',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Hier kannst du dir einen 2-Faktor-Code generieren um dich in einen geteilten Kult-Account einzuloggen.',
        },
      },
      ...accounts.map((a) => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${a.account}* (${a.service})`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Code generieren',
          },
          value: `${a.account}@${a.service}`,
          action_id: 'two-factor-code',
        },
      })),
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'Generierte Codes sind nur für dich sichtbar und 30 Sekunden lang gültig. Es ist für alle sichbar, dass du dir einen Code generiert hast.',
          },
        ],
      },
    ],
  });
}
