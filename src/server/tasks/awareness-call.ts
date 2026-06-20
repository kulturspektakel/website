import {readJsonPayload} from '../../server/readJsonPayload.server';
import {placeAwarenessCall} from '../twilio.server';

export type AwarenessCallPayload = {
  name: string;
  message?: string;
};

/**
 * Place a Twilio voice call that reads the help request out to the on-call
 * phone. Separate from the Slack task so a Twilio failure retries independently
 * and never blocks (or duplicates) the Slack notification. Throws on failure so
 * Cloud Tasks retries.
 */
export async function handleAwarenessCall(request: Request): Promise<Response> {
  const data = await readJsonPayload<AwarenessCallPayload>(request);

  const spoken = [
    'Neue Awareness Anfrage über die Website.',
    `Name: ${data.name}.`,
    data.message ? `Anliegen: ${data.message}.` : 'Kein Anliegen angegeben.',
  ].join(' ');

  await placeAwarenessCall(spoken);

  return new Response(null, {status: 204});
}
