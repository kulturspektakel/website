// Twilio call-routing webhook: a "hunt group with press-1 screening". An
// incoming call is parked in a conference on hold; every number in
// TWILIO_DIAL_NUMBERS is rung in parallel and screened with a "press 1 to
// accept" prompt. Only the callee who presses 1 joins the conference (gets
// bridged to the caller); the remaining legs are then canceled. If nobody
// accepts, the caller is hung up once the last leg ends.
//
// A conference is required (rather than a simple <Dial> whisper) because <Dial>
// cancels the sibling legs the instant one is *answered* — we must keep the
// others ringing until someone *presses 1*.
//
// The four endpoints (see src/routes/api.twilio.*.ts) are all guarded by the
// verifyTwilioSignature middleware, which parses the form body and passes it as
// `twilioParams`. The conference name is the inbound call's CallSid, carried in
// the `conf` query param to the screen/accept/leg-status callbacks.
import {ApiError} from './apiError.server';
import {endCall, listActiveCallsTo, placeCall} from './twilio.server';

const RING_TIMEOUT_SECONDS = 25;

function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) {
    throw new ApiError(500, 'SITE_URL is not set');
  }
  return url.replace(/\/$/, '');
}

export function parseDialNumbers(): string[] {
  const raw = process.env.TWILIO_DIAL_NUMBERS;
  const numbers = (raw ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  if (numbers.length === 0) {
    throw new ApiError(500, 'TWILIO_DIAL_NUMBERS is not set');
  }
  return numbers;
}

const XML_HEADERS = {'Content-Type': 'text/xml'} as const;

function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: XML_HEADERS,
  });
}

// --- Pure TwiML builders (unit-testable) ---

export function incomingTwiml(conf: string): string {
  return `<Response><Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false">${conf}</Conference></Dial></Response>`;
}

export function screenTwiml(conf: string, base: string): string {
  const action = `${base}/api/twilio/accept?conf=${encodeURIComponent(conf)}`;
  return `<Response><Gather numDigits="1" timeout="15" action="${action}"><Say voice="Polly.Vicki" language="de-DE">Anruf von der Website. Drücken Sie die Eins, um anzunehmen.</Say></Gather><Hangup/></Response>`;
}

export function acceptTwiml(conf: string): string {
  return `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${conf}</Conference></Dial></Response>`;
}

export function hangupTwiml(): string {
  return `<Response><Hangup/></Response>`;
}

function conferenceName(request: Request): string {
  const conf = new URL(request.url).searchParams.get('conf');
  if (!conf) {
    throw new ApiError(400, 'Missing conf');
  }
  return conf;
}

// --- Handlers ---

/** Incoming call: ring every destination number, park the caller on hold. */
export async function handleTwilioIncoming(
  params: URLSearchParams,
): Promise<Response> {
  const callSid = params.get('CallSid');
  if (!callSid) {
    throw new ApiError(400, 'Missing CallSid');
  }

  const base = siteUrl();
  const conf = encodeURIComponent(callSid);
  const screenUrl = `${base}/api/twilio/screen?conf=${conf}`;
  const statusCallback = `${base}/api/twilio/leg-status?conf=${conf}`;

  // Fire all legs; a single bad number shouldn't abort the whole hunt group.
  const results = await Promise.allSettled(
    parseDialNumbers().map((to) =>
      placeCall({
        to,
        url: screenUrl,
        statusCallback,
        statusCallbackEvent: ['completed'],
        timeout: RING_TIMEOUT_SECONDS,
      }),
    ),
  );
  const placed = results.filter((r) => r.status === 'fulfilled').length;
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('Twilio leg failed to place', r.reason);
    }
  }

  // No legs placed → nobody to wait for; hang up instead of parking forever.
  return xml(placed > 0 ? incomingTwiml(callSid) : hangupTwiml());
}

/** Answered destination leg: prompt the callee to press 1. */
export async function handleTwilioScreen(request: Request): Promise<Response> {
  return xml(screenTwiml(conferenceName(request), siteUrl()));
}

/** Gather result: bridge on "1", cancel the siblings; otherwise hang up. */
export async function handleTwilioAccept(
  params: URLSearchParams,
  request: Request,
): Promise<Response> {
  const conf = conferenceName(request);
  if (params.get('Digits') !== '1') {
    return xml(hangupTwiml());
  }

  // Cancel the other still-live screening legs so they stop ringing. Best
  // effort — if it fails we still bridge the callee who accepted.
  const acceptingSid = params.get('CallSid');
  try {
    const active = await listActiveCallsTo(parseDialNumbers());
    await Promise.all(
      active
        .filter((c) => c.sid !== acceptingSid)
        .map((c) =>
          endCall(c.sid, c.status === 'in-progress' ? 'completed' : 'canceled'),
        ),
    );
  } catch (e) {
    console.error('Failed to cancel sibling legs', e);
  }

  return xml(acceptTwiml(conf));
}

/** Leg status callback: hang up the parked caller once every leg has ended
 * without anyone accepting (a bridged callee leg stays in-progress, so its
 * presence keeps the caller connected). */
export async function handleTwilioLegStatus(
  params: URLSearchParams,
  request: Request,
): Promise<Response> {
  const conf = new URL(request.url).searchParams.get('conf');
  if (conf && params.get('CallStatus') === 'completed') {
    try {
      const active = await listActiveCallsTo(parseDialNumbers());
      if (active.length === 0) {
        // conf === inbound CallSid; idempotent if already ended.
        await endCall(conf, 'completed');
      }
    } catch (e) {
      console.error('Failed to handle leg status', e);
    }
  }
  return new Response(null, {status: 204});
}
