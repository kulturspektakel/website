import {createMiddleware} from '@tanstack/react-start';
import {getCookie} from '@tanstack/react-start/server';
import {verifyDirectusSession} from './directusAuth.server';
import {resolveCrewViewer} from './currentViewer.server';

/**
 * Function middleware for crew server functions. Verifies the Directus session
 * server-side (reading the httpOnly `directus_session_token` cookie and checking
 * the JWT signature), then exposes the Slack-keyed `Viewer` it maps to as
 * `context.viewer` — a trusted value the client cannot forge, since `context` is
 * never part of the RPC payload. `Viewer` is the identity all crew data is keyed
 * on; it's provisioned on first sight, and is `null` only when no Slack-keyed
 * Viewer can be formed (Directus account without an `external_identifier`).
 *
 * A missing/invalid session always throws, so directly-invoked RPCs are gated
 * even though the route `beforeLoad` only runs on navigation. This is enforced
 * in dev too: the cookie is scoped to `crew.kulturspektakel.de` and won't reach
 * localhost on its own, so to work on `/crew/*` locally copy a valid
 * `directus_session_token` from the deployed crew app into a localhost cookie
 * (the JWT verifies against the same `JWT_SECRET` regardless of origin).
 *
 * This module is intentionally NOT a `.server.ts`: a middleware built with
 * `createMiddleware().server()` is referenced in the `.middleware([crewAuth])`
 * chain of client-bundled route files, so it must clear `.server.*` import
 * protection. The server-only bits (`verifyDirectusSession`, `getCookie`,
 * `resolveCrewViewer`) are referenced only inside the `.server()` callback,
 * which the compiler extracts server-side.
 *
 * Note: there is deliberately no `crewServerFn` factory wrapping `createServerFn`.
 * The Start compiler only splits a literal `createServerFn().handler()` chain, so
 * each crew fn must spell out `createServerFn().middleware([crewAuth])` itself.
 */
export const crewAuth = createMiddleware({type: 'function'}).server(
  async ({next}) => {
    const session = verifyDirectusSession(getCookie('directus_session_token'));
    if (!session) {
      throw new Error('Unauthorized');
    }
    const viewer = await resolveCrewViewer(session.id);
    return next({context: {viewer}});
  },
);
