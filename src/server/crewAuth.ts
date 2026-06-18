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
 *
 * This module is intentionally NOT a `.server.ts`: a middleware built with
 * `createMiddleware().server()` is referenced in the `.middleware([crewAuth])`
 * chain of client-bundled route files, so it must clear `.server.*` import
 * protection. The server-only bits (`verifyDirectusSession`, `getCookie`) are
 * referenced only inside the `.server()` callback, which the compiler extracts
 * server-side.
 *
 * Note: there is deliberately no `crewServerFn` factory wrapping `createServerFn`.
 * The Start compiler only splits a literal `createServerFn().handler()` chain, so
 * each crew fn must spell out `createServerFn().middleware([crewAuth])` itself.
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
