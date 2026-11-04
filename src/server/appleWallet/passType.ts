import {CREW_PASS_CERTIFICATE} from './certificates';

// Kept apart from pass.server.ts (and its Vite-only image imports) so scripts
// run with tsx can use it, e.g. to send pushes.

export const APPLE_TEAM_ID = 'S279DHCCVB';

/**
 * Every Pass Type ID has its own certificate, so each pass type gets its own
 * entry here; only the certificate's private key is a secret. The same
 * certificate and key sign the passes and authenticate their APNs pushes.
 */
export const CREW_PASS = {
  passTypeIdentifier: 'pass.de.kulturspektakel.crew',
  certificate: CREW_PASS_CERTIFICATE,
  privateKey: () => process.env.APPLE_WALLET_CREW_PASS_PRIVATE_KEY,
};
