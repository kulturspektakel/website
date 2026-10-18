/**
 * One-off: send a donation-confirmation email to every donor with an
 * unset `sentConfirmationAt`. Ported from
 * `~/api.kulturspektakel.de/scripts/donations.ts`.
 *
 * `yarn email:donations` to run.
 */
import 'dotenv/config';
import {and, eq, gte, isNotNull, isNull, notInArray} from 'drizzle-orm';
import {db} from '../src/server/db.server';
import {donation as donationTable} from '../src/server/db/schema';
import {sendMail} from '../src/server/sendMail.server';

async function main() {
  const donations = await db.query.donation.findMany({
    where: and(
      notInArray(donationTable.source, ['Other', 'Membership']),
      gte(donationTable.amount, 2500),
      isNotNull(donationTable.email),
      isNull(donationTable.sentConfirmationAt),
    ),
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

    await db
      .update(donationTable)
      .set({sentConfirmationAt: new Date()})
      .where(eq(donationTable.id, donation.id));
    console.log(`Sending email to ${donation.email}`);
  }
}

await main();
await db.$client.end();
