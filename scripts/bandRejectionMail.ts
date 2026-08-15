/**
 * One-off: send rejection emails to band applications that weren't picked
 * for the current event. Deduplicates against already-replied threads in
 * the booking@ inbox (so manually-replied bands aren't double-mailed).
 * Ported from `~/api.kulturspektakel.de/scripts/bandRejectionMail.ts`.
 *
 * Set `EVENT_ID` before running. `yarn email:band-rejection` to run.
 */
import 'dotenv/config';
import {gmailClient} from '../src/server/gmail.server';
import {prismaClient} from '../src/server/prismaClient.server';
import {sendMail} from '../src/server/sendMail.server';

const account = 'booking@kulturspektakel.de';
const EVENT_ID = 'kult2026';

async function main() {
  const event = await prismaClient.event.findUniqueOrThrow({
    where: {id: EVENT_ID},
  });

  const data = await prismaClient.bandApplication.findMany({
    where: {
      contactedByViewerId: null,
      lastContactedAt: null,
      eventId: EVENT_ID,
      genreCategory: {not: 'DJ'},
    },
  });
  console.log(`Sending ${data.length} rejections for ${event.name}`);

  // Same delegated read-only client the app uses; `gmailClient` defaults to the
  // `gmail.readonly` scope this script needs.
  const gmail = await gmailClient(account);

  const res = await gmail.users.messages.list({
    userId: account,
    q: `in:sent after:${event.bandApplicationStart}`,
  });

  const emails = new Set(
    await Promise.all(
      res.data.messages?.map(async (m) => {
        const message = await gmail.users.messages.get({
          userId: account,
          id: m.id ?? '',
        });
        const to = message.data.payload?.headers
          ?.find(({name}) => name === 'To')
          ?.value?.toLocaleLowerCase();
        if (to?.endsWith('>')) {
          return to.match(/<(.+)>$/)?.at(1);
        }
        return to;
      }) ?? [],
    ),
  );

  for (const band of data) {
    if (emails.has(band.email.toLocaleLowerCase())) {
      console.error(
        `${band.bandname} has been contacted. Not sending a rejection`,
      );
      continue;
    }

    const eventYear = String(event.start.getFullYear());
    await sendMail(
      'rejectBandApplication',
      'Kulturspektakel Gauting Booking <booking@kulturspektakel.de>',
      {bandname: band.bandname, eventYear},
      {to: band.email},
    );

    console.log(`Sent: ${band.bandname}`);
    await prismaClient.bandApplication.update({
      data: {lastContactedAt: new Date()},
      where: {id: band.id},
    });
  }
}

await main();
