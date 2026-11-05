import {connect, type ClientHttp2Session} from 'node:http2';
import {eq, inArray} from 'drizzle-orm';
import {db} from '../db.server';
import {walletPassRegistration} from '../db/schema';
import {CREW_PASS} from './pass.server';

/**
 * Pass update pushes. A Wallet push carries no content: it only tells the
 * device to ask the web service (appleWalletWebService.ts) which of its passes
 * changed and to fetch those. Any notification the user sees comes from a
 * changed field's `changeMessage` in the new pass.
 *
 * Wallet passes only use production APNs, authenticated with the pass type's
 * own certificate and key (no .p8 token auth), topic = pass type id.
 */
const APNS_URL = 'https://api.push.apple.com';

type PassPushResult = {
  pushToken: string;
  status: number;
  /** APNs' error reason, e.g. `BadDeviceToken`. */
  reason?: string;
};

/** Sends the (empty) update push to each token over one HTTP/2 connection. */
async function sendPassPushes(pushTokens: string[]): Promise<PassPushResult[]> {
  if (pushTokens.length === 0) {
    return [];
  }
  const key = CREW_PASS.privateKey();
  if (!key) {
    throw new Error('Apple Wallet is not configured');
  }
  const session = connect(APNS_URL, {cert: CREW_PASS.certificate, key});
  // Errors also reach the open requests, which reject with them.
  session.on('error', () => {});
  try {
    return await Promise.all(
      pushTokens.map((pushToken) => sendPush(session, pushToken)),
    );
  } finally {
    session.close();
  }
}

function sendPush(
  session: ClientHttp2Session,
  pushToken: string,
): Promise<PassPushResult> {
  return new Promise((resolve, reject) => {
    const request = session.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': CREW_PASS.passTypeIdentifier,
      'content-type': 'application/json',
    });
    let status = 0;
    let body = '';
    request.on('response', (headers) => {
      status = Number(headers[':status']);
    });
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => {
      let reason: string | undefined;
      try {
        reason = body ? JSON.parse(body).reason : undefined;
      } catch {
        reason = body;
      }
      resolve({pushToken, status, reason});
    });
    request.on('error', reject);
    request.end('{}');
  });
}

/**
 * Pushes to every device that has the card's pass (see crewCardPass.server.ts,
 * which decides when). Push tokens APNs reports as dead are dropped along with
 * their registrations.
 */
export async function pushToCrewCardDevices(cardId: Buffer): Promise<void> {
  const registrations = await db.query.walletPassRegistration.findMany({
    where: eq(walletPassRegistration.crewCardId, cardId),
    columns: {pushToken: true},
  });
  const results = await sendPassPushes([
    ...new Set(registrations.map(({pushToken}) => pushToken)),
  ]);

  const dead = results
    .filter(
      ({status, reason}) =>
        status === 410 || (status === 400 && reason === 'BadDeviceToken'),
    )
    .map(({pushToken}) => pushToken);
  if (dead.length > 0) {
    await db
      .delete(walletPassRegistration)
      .where(inArray(walletPassRegistration.pushToken, dead));
  }
}
