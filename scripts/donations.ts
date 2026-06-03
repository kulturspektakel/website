/**
 * One-off: send a donation-confirmation email to every donor with an
 * unset `sentConfirmationAt`. Ported from
 * `~/api.kulturspektakel.de/scripts/donations.ts`.
 *
 * `yarn email:donations` to run.
 */
import 'dotenv/config';
import {prismaClient} from '../src/utils/prismaClient.server';
import {sendMail} from '../src/utils/sendMail.server';

async function main() {
  const donations = await prismaClient.donation.findMany({
    where: {
      source: {notIn: ['Other', 'Membership']},
      amount: {gte: 2500},
      email: {not: null},
      sentConfirmationAt: {equals: null},
    },
  });

  for (const donation of donations) {
    await sendMail(
      'donation',
      'Kulturspektakel Gauting Kasse <kasse@kulturspektakel.de>',
      {
        link: `https://www.kulturspektakel.de/spenden/quittung/${donation.id}`,
      },
      {to: donation.email!},
    );

    await prismaClient.donation.update({
      where: {id: donation.id},
      data: {sentConfirmationAt: new Date()},
    });
    console.log(`Sending email to ${donation.email}`);
  }
}

await main();
