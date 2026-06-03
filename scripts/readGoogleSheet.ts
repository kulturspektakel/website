/**
 * Read a Google Sheet via the public Sheets API. Used by the `bandInfosheet`
 * and `bandLineup` scripts to fan emails out from a spreadsheet.
 *
 * Needs `GOOGLE_SHEETS_KEY` (the API key restricted to sheets.googleapis.com,
 * provisioned in terraform/production.tf and synced into `.env`).
 */
import {env} from '../src/utils/env.server';

export async function readGoogleSheet(sheetId: string, sheetName: string) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?key=${env.GOOGLE_SHEETS_KEY}`,
  );
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as {
    range: string;
    majorDimension: string;
    values: string[][];
  };
}
