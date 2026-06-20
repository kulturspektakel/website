// Places an outbound voice call that reads `text` aloud (German TTS) via the
// Twilio REST API — used to escalate an awareness help request to the on-call
// phone. Raw REST (no SDK dependency); the spoken message is passed as inline
// TwiML so we don't need to host a TwiML webhook.
//
// Auth via a Twilio API Key (recommended over the account auth token). The
// API key pair is the Basic-Auth credential, but the request path still uses
// the account SID. Requires four env vars:
//   TWILIO_ACCOUNT_SID  — account SID (AC…), used in the REST URL path
//   TWILIO_API_KEY      — API key SID (SK…), Basic-Auth username
//   TWILIO_API_SECRET   — API key secret, Basic-Auth password
//   TWILIO_FROM_NUMBER  — a Twilio voice number to call from
// The call destination is the public awareness number (AWARENESS_PHONE).
import {AWARENESS_PHONE} from '../utils/awarenessContact';

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

export async function placeAwarenessCall(text: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = AWARENESS_PHONE;
  if (!accountSid || !apiKey || !apiSecret || !from) {
    throw new Error(
      'TWILIO_ACCOUNT_SID / TWILIO_API_KEY / TWILIO_API_SECRET / TWILIO_FROM_NUMBER not set',
    );
  }

  const twiml = `<Response><Say voice="Polly.Vicki" language="de-DE">${escapeXml(
    text,
  )}</Say></Response>`;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        // Basic auth = API key SID : API key secret.
        Authorization:
          'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({To: to, From: from, Twiml: twiml}),
    },
  );

  if (!res.ok) {
    throw new Error(`Twilio call failed (${res.status}): ${await res.text()}`);
  }
}
