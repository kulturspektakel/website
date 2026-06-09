/**
 * One-off: send the "infosheet" email to each band in the Google Sheet.
 * Ported from `~/api.kulturspektakel.de/scripts/bandInfosheet.ts`.
 *
 * Fill in `SHEET_ID` before running. `yarn email:band-infosheet` to run.
 */
import 'dotenv/config';
import {sendMail} from '../src/server/sendMail.server';
import {readGoogleSheet} from './readGoogleSheet';

const SHEET_ID = '---';
const SHEET_NAME = 'Infosheets';

async function main() {
  const {values} = await readGoogleSheet(SHEET_ID, SHEET_NAME);

  for (const band of values) {
    const [
      day,
      stage,
      getin,
      soundcheck,
      start,
      end,
      bandname,
      fee,
      contact,
      backupContact,
      name,
      email,
    ] = band;
    const eventYear = String(new Date().getFullYear());

    await sendMail(
      'infosheet',
      'Kulturspektakel Gauting Booking <booking@kulturspektakel.de>',
      {
        day,
        stage,
        getin,
        soundcheck,
        start,
        end,
        bandname,
        fee,
        contact,
        backupContact,
        name,
        eventYear,
      },
      {
        to: email.split(',').map((e: string) => e.trim()),
      },
    );
    console.log(`Sent for ${bandname}`);
  }
}

await main();
