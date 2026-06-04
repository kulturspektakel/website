import {printFormat} from 'iban-ts';
import type {schema} from '../../routes/_main.mitgliedsantrag';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';
import {readJsonPayload} from '../../utils/readJsonPayload.server';
import {slackApiRequest} from '../../utils/slack.server';
import {SlackChannel} from '../../utils/slackChannels';
import type {z} from 'zod';

export type CreateMembershipApplicationPayload = z.infer<typeof schema>;

// Annual membership fees in cents. Kept in sync with the form in
// `src/routes/_main.mitgliedsantrag.tsx` (which can't be imported here without
// pulling client deps into the server bundle).
const MEMBERSHIP_FEES = {
  kult: {reduced: 1500, regular: 3000},
  foerderverein: {reduced: 1500, regular: 3000},
} as const;

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/createMembershipApplication.ts`.
 * Fans a submitted membership application out to three places: a Slack
 * announcement in #zuschuesse, an internal notification email to the relevant
 * Vereins-mailbox, and a confirmation email to the new member. Both emails are
 * dispatched via the `send-email` Cloud Task so each retries independently.
 */
export async function handleCreateMembershipApplication(
  request: Request,
): Promise<Response> {
  const data =
    await readJsonPayload<CreateMembershipApplicationPayload>(request);

  const iban = printFormat(data.iban, '');
  const ibanMasked = `${iban.substring(0, 5)}${'*'.repeat(iban.length - 8)}${iban.slice(-3)}`;

  const membershipFee = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(
    (data.membershipType === 'supporter'
      ? data.membershipFee
      : MEMBERSHIP_FEES[data.membership][data.membershipType]) / 100,
  );

  const supporter =
    data.membershipType === 'supporter'
      ? ` mit einem Förderbeitrag von ${membershipFee}`
      : '';

  const senderEmail =
    data.membership === 'foerderverein'
      ? 'foerderverein@kulturspektakel.de'
      : 'kasse@kulturspektakel.de';

  const sender =
    data.membership === 'foerderverein'
      ? ('Förderverein Kulturspektakel Gauting <foerderverein@kulturspektakel.de>' as const)
      : ('Kulturspektakel Gauting Kasse <kasse@kulturspektakel.de>' as const);

  const accountHolder =
    data.accountHolder === 'different'
      ? [data.accountHolderName, data.accountHolderAddress, data.accountHolderCity]
          .filter(Boolean)
          .join(', ')
      : undefined;

  await Promise.all([
    slackApiRequest('chat.postMessage', {
      channel: SlackChannel.zuschuesse,
      text: `${data.name} ist jetzt Mitglied im ${getLegalName(data.membership)}${supporter}`,
    }),
    enqueueGcpTask('send-email', {
      from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
      to: sender,
      subject: `Mitgliedsantrag ${data.name}`,
      text: `Verein: ${getLegalName(data.membership)}
Datum des Antrags: ${new Date().toLocaleDateString('de-DE')}
Mitgliedsbeitrag: ${membershipFee}
Name: ${data.name}
Adresse: ${data.address}
Ort: ${data.city}
E-Mail: ${data.email}
IBAN: ${data.iban}
${accountHolder ? `Kontoinhaber: ${accountHolder}` : ''}
`,
    }),
    enqueueGcpTask('send-email', {
      from: sender,
      to: data.email,
      template: 'confirmMembership',
      variables: {
        iban: ibanMasked,
        senderEmail,
        membership: getLegalName(data.membership),
        membershipFee,
      },
    }),
  ]);

  return new Response(null, {status: 204});
}

function getLegalName(name: CreateMembershipApplicationPayload['membership']) {
  switch (name) {
    case 'foerderverein':
      return 'Förderverein Kulturspektakel Gauting e.V.';
    case 'kult':
      return 'Kulturspektakel Gauting e.V.';
  }
}
