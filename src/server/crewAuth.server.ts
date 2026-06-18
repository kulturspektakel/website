import {createMiddleware} from '@tanstack/react-start';
import {getCookie} from '@tanstack/react-start/server';
import {verifyDirectusSession} from './directusAuth.server';

/**
 * Function middleware for crew server functions. Verifies the Directus session
 * server-side (reading the httpOnly `directus_session_token` cookie and checking
 * the JWT signature) and exposes the result to handlers as `context.user` — a
 * trusted value the client cannot forge, since `context` is never part of the
 * RPC payload.
 *
 * In production a missing/invalid session throws, so directly-invoked RPCs are
 * gated even though the route `beforeLoad` only runs on navigation. In dev the
 * check is skipped (the cookie is scoped to `crew.kulturspektakel.de` and never
 * reaches localhost), so `context.user` is `null` there — mirroring the route
 * gate in `crew.tsx`.
 */
export const crewAuth = createMiddleware({type: 'function'}).server(
  async ({next}) => {
    const user = verifyDirectusSession(getCookie('directus_session_token'));
    if (!user && process.env.NODE_ENV === 'production') {
      throw new Error('Unauthorized');
    }
    return next({context: {user: user ?? null}});
  },
);
