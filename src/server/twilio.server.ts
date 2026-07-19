// Places an outbound voice call that reads `text` aloud (German TTS) via the
// Twilio REST API — used to escalate an awareness help request to the on-call
// phones. Raw REST (no SDK dependency); the spoken message is passed as inline
// TwiML so we don't need to host a TwiML webhook.
//
// Auth via a Twilio API Key (recommended over the account auth token). The
// API key pair is the Basic-Auth credential, but the request path still uses
// the account SID. Requires four env vars:
//   TWILIO_ACCOUNT_SID  — account SID (AC…), used in the REST URL path
//   TWILIO_API_KEY      — API key SID (SK…), Basic-Auth username
//   TWILIO_API_SECRET   — API key secret, Basic-Auth password
//   TWILIO_FROM_NUMBER  — a Twilio voice number to call from
// The destination number(s) are supplied by the caller (see awareness-call).

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

const REST_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

type TwilioCreds = {accountSid: string; authHeader: string; from: string};

// Shared REST credentials. Auth via a Twilio API Key (the key SID/secret are the
// Basic-Auth pair) while the request path still uses the account SID.
function twilioCreds(): TwilioCreds {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !apiKey || !apiSecret || !from) {
    throw new Error(
      'TWILIO_ACCOUNT_SID / TWILIO_API_KEY / TWILIO_API_SECRET / TWILIO_FROM_NUMBER not set',
    );
  }
  return {
    accountSid,
    authHeader:
      'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64'),
    from,
  };
}

export async function placeAwarenessCall(text: string, to: string): Promise<void> {
  const creds = twilioCreds();
  const twiml = `<Response><Say voice="Polly.Vicki" language="de-DE">${escapeXml(
    text,
  )}</Say></Response>`;

  const res = await fetch(`${REST_BASE}/${creds.accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: creds.authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({To: to, From: creds.from, Twiml: twiml}),
  });

  if (!res.ok) {
    throw new Error(`Twilio call failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Place an outbound call whose answered leg fetches `url` for TwiML. Returns the
 * new call's SID. Used by the call-routing webhook to ring each destination
 * number with a "press 1 to accept" screening prompt.
 */
export async function placeCall(opts: {
  to: string;
  url: string;
  statusCallback?: string;
  statusCallbackEvent?: string[];
  timeout?: number;
}): Promise<string> {
  const creds = twilioCreds();
  const body = new URLSearchParams({To: opts.to, From: creds.from, Url: opts.url});
  if (opts.statusCallback) {
    body.set('StatusCallback', opts.statusCallback);
    for (const event of opts.statusCallbackEvent ?? []) {
      body.append('StatusCallbackEvent', event);
    }
  }
  if (opts.timeout != null) {
    body.set('Timeout', String(opts.timeout));
  }

  const res = await fetch(`${REST_BASE}/${creds.accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: creds.authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Twilio placeCall failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as {sid: string};
  return json.sid;
}

export type ActiveCall = {sid: string; to: string; status: string};

/**
 * List the calls to any of `numbers` that are still live (queued, ringing or
 * in-progress). Used to find the sibling screening legs so we can cancel them
 * when one callee accepts, and to detect when every leg has ended.
 */
export async function listActiveCallsTo(numbers: string[]): Promise<ActiveCall[]> {
  const creds = twilioCreds();
  const calls: ActiveCall[] = [];
  for (const status of ['queued', 'ringing', 'in-progress'] as const) {
    for (const to of numbers) {
      const qs = new URLSearchParams({To: to, Status: status, PageSize: '50'});
      const res = await fetch(
        `${REST_BASE}/${creds.accountSid}/Calls.json?${qs}`,
        {headers: {Authorization: creds.authHeader}},
      );
      if (!res.ok) {
        throw new Error(
          `Twilio listCalls failed (${res.status}): ${await res.text()}`,
        );
      }
      const json = (await res.json()) as {calls?: {sid: string; to: string}[]};
      for (const c of json.calls ?? []) {
        calls.push({sid: c.sid, to: c.to, status});
      }
    }
  }
  return calls;
}

/**
 * End a call leg. Use `completed` for an in-progress call and `canceled` for one
 * that is still queued/ringing (Twilio rejects the wrong verb for the state).
 * Already-ended calls (404/409) are treated as success.
 */
export async function endCall(
  sid: string,
  status: 'completed' | 'canceled',
): Promise<void> {
  const creds = twilioCreds();
  const res = await fetch(`${REST_BASE}/${creds.accountSid}/Calls/${sid}.json`, {
    method: 'POST',
    headers: {
      Authorization: creds.authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({Status: status}),
  });
  if (!res.ok && res.status !== 404 && res.status !== 409) {
    throw new Error(`Twilio endCall failed (${res.status}): ${await res.text()}`);
  }
}
