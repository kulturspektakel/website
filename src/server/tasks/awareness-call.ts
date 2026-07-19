import {readJsonPayload} from '../../server/readJsonPayload.server';
import {placeAwarenessCall} from '../twilio.server';
import {parseDialNumbers} from '../twilioRouting';

export type AwarenessCallPayload = {
  name: string;
  message?: string;
};

/**
 * Place a Twilio voice call that reads the help request out to every on-call
 * phone in TWILIO_DIAL_NUMBERS. Separate from the Slack task so a Twilio failure
 * retries independently and never blocks (or duplicates) the Slack
 * notification. A single bad number shouldn't abort the rest; we only throw
 * (triggering a Cloud Tasks retry) if no leg could be placed at all — otherwise
 * a retry would re-ring the numbers that already succeeded.
 */
export async function handleAwarenessCall(request: Request): Promise<Response> {
  const data = await readJsonPayload<AwarenessCallPayload>(request);

  const spoken = [
    'Neue Awareness Anfrage über die Website.',
    `Name: ${data.name}.`,
    data.message ? `Anliegen: ${data.message}.` : 'Kein Anliegen angegeben.',
  ].join(' ');

  const results = await Promise.allSettled(
    parseDialNumbers().map((to) => placeAwarenessCall(spoken, to)),
  );
  const placed = results.filter((r) => r.status === 'fulfilled').length;
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('Awareness call leg failed to place', r.reason);
    }
  }
  if (placed === 0) {
    throw new Error('All awareness call legs failed to place');
  }

  return new Response(null, {status: 204});
}
