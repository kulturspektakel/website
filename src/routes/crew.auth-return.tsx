import {createFileRoute, redirect} from '@tanstack/react-router';

/**
 * Landing route Directus redirects back to after a successful Slack SSO login
 * (the single path allow-listed in `AUTH_SLACK_REDIRECT_ALLOW_LIST`). By now the
 * `directus_session_token` cookie is set, so the parent `/crew` gate passes;
 * this route just forwards to `to`, the page originally requested.
 */
export const Route = createFileRoute('/crew/auth-return')({
  validateSearch: (search): {to?: string} => ({
    to: typeof search.to === 'string' ? search.to : undefined,
  }),
  beforeLoad: ({search}) => {
    // Only forward to an internal crew path — never an absolute or
    // protocol-relative URL — so this can't be abused as an open redirect.
    const dest =
      search.to && /^\/crew(\/|$)/.test(search.to)
        ? search.to
        : '/crew/lautstaerke';
    throw redirect({href: dest});
  },
});
