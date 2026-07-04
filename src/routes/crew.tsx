import {createFileRoute, Outlet, redirect} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {getCookie, setResponseHeader} from '@tanstack/react-start/server';
import {ChakraProvider} from '@chakra-ui/react';
import crewTheme from '../theme-crew';
import {verifyDirectusSession} from '../server/directusAuth.server';
import {crewAuth} from '../server/crewAuth';

/**
 * Build the Directus Slack-SSO login URL for an unauthenticated visitor, or
 * `null` when the request already carries a valid session. Runs server-side (on
 * SSR and as an RPC during client navigation) so it can read the httpOnly
 * cookie and the signing secret.
 *
 * The SSO endpoint logs the user in (setting `directus_session_token`) and then
 * redirects back to `/crew/auth-return`, which forwards to `to` — the page they
 * originally requested. That return path must be listed verbatim in
 * `AUTH_SLACK_REDIRECT_ALLOW_LIST` on the Directus side (it matches origin+path
 * exactly, ignoring the query string), or Directus refuses the redirect.
 *
 * The session is required in dev too. The login redirect points back at the
 * deployed crew app (via `SITE_URL`), so logging in from `localhost` isn't
 * possible — instead copy a valid `directus_session_token` from the deployed
 * crew app into a localhost cookie (the JWT verifies against the same
 * `JWT_SECRET` regardless of origin).
 */
const crewLoginUrl = createServerFn()
  .inputValidator((to: string) => to)
  .handler(({data}) => {
    // Crew pages render user-specific content; never let a CDN or proxy cache
    // them. Set on every /crew/* request via this beforeLoad server fn.
    setResponseHeader('Cache-Control', 'private, no-store');
    if (verifyDirectusSession(getCookie('directus_session_token'))) {
      return null;
    }
    const returnUrl = new URL('/crew/auth-return', process.env.SITE_URL);
    returnUrl.searchParams.set('to', data);
    const login = new URL('https://crew.kulturspektakel.de/auth/login/slack');
    login.searchParams.set('redirect', returnUrl.toString());
    return login.toString();
  });

// The current Slack-keyed Viewer, resolved once at the crew boundary. Exposed as
// loader data (cached, dehydrated on SSR, not re-run when navigating between
// child pages) so any crew component can read it via
// `useLoaderData({from: '/crew'})` — e.g. to author optimistic ratings/comments.
// `null` for a Directus account with no Slack-keyed Viewer.
const loadCrewViewer = createServerFn()
  .middleware([crewAuth])
  .handler(({context}) => context.viewer);

export const Route = createFileRoute('/crew')({
  beforeLoad: async ({location}) => {
    const login = await crewLoginUrl({data: location.href});
    if (login) {
      throw redirect({href: login});
    }
  },
  loader: () => loadCrewViewer(),
  component: CrewLayout,
});

function CrewLayout() {
  return (
    <ChakraProvider value={crewTheme}>
      <Outlet />
    </ChakraProvider>
  );
}
