import {createHash} from 'node:crypto';

/**
 * Per-viewer password for the OwnTracks HTTP endpoint (HTTP Basic Auth,
 * username = viewer id). Migrated verbatim from the legacy api — keeps the same
 * `sha1(viewerId + JWT_SECRET)` derivation so existing device configs (which
 * embed the password) keep working, provided `JWT_SECRET` matches the legacy value.
 */
export function ownTracksPassword(viewerId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return createHash('sha1').update(`${viewerId}${secret}`).digest('hex');
}
