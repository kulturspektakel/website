import * as Sentry from '@sentry/tanstackstart-react';

// Server-side Sentry init. Imported as the very first line of `server.ts` so it
// initializes before the request handler runs (serverless-friendly path — no
// `--import` flag, which doesn't apply to Vercel/Nitro functions).
// `import.meta.env.VITE_SENTRY_DSN` is inlined into the server bundle at build
// time by Vite, so it needs no runtime env lookup.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Only send to Sentry in production builds — no-op during `yarn dev`.
  enabled: import.meta.env.PROD,
  enableLogs: true,
  tracesSampleRate: 0.1,
});
