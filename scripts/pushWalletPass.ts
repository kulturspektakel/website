// Sends a pass update push to every device that has a wallet CrewCard: marks
// the pass as changed, then the devices fetch it from the web service. With
// `--message`, first sets the pass's "Neuigkeiten", which Wallet then shows as
// a notification. Without a serial, lists the registered passes.
//
// Needs the pass type's private key, which only lives in Secret Manager:
//
//   APPLE_WALLET_CREW_PASS_PRIVATE_KEY="$(gcloud secrets versions access latest \
//     --secret=APPLE_WALLET_CREW_PASS_PRIVATE_KEY)" \
//     yarn tsx scripts/pushWalletPass.ts [<serial> [--message <text>]]
import 'dotenv/config';
import {desc} from 'drizzle-orm';
import {db} from '../src/server/db.server';
import {walletPassRegistration} from '../src/server/db/schema';
import {pushCrewCardPassUpdate} from '../src/server/appleWallet/push.server';

async function main() {
  const serial = process.argv[2];
  const messageFlag = process.argv.indexOf('--message');
  const walletMessage =
    messageFlag === -1 ? undefined : process.argv[messageFlag + 1];
  if (messageFlag !== -1 && !walletMessage) {
    throw new Error('--message needs a text');
  }

  if (!serial) {
    const registrations = await db.query.walletPassRegistration.findMany({
      columns: {
        crewCardId: true,
        deviceLibraryIdentifier: true,
        createdAt: true,
      },
      orderBy: desc(walletPassRegistration.createdAt),
    });
    for (const r of registrations) {
      console.log(
        Buffer.from(r.crewCardId).toString('hex').toUpperCase(),
        r.deviceLibraryIdentifier,
        r.createdAt.toISOString(),
      );
    }
    console.log(`${registrations.length} registrations.`);
    return;
  }

  if (!/^[0-9A-F]{14}$/.test(serial)) {
    throw new Error('Serial must be 14 uppercase hex characters');
  }
  // Not via cardUtils: it pulls in badge SVGs, which tsx can't load.
  const results = await pushCrewCardPassUpdate(
    Buffer.from(serial, 'hex'),
    walletMessage === undefined ? {} : {walletMessage},
  );
  if (results.length === 0) {
    console.log('No devices registered for this pass.');
  }
  for (const {pushToken, status, reason} of results) {
    console.log(
      `${pushToken.slice(0, 8)}…: ${status}${reason ? ` ${reason}` : ''}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
