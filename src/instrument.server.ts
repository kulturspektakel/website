import * as Sentry from '@sentry/tanstackstart-react';

// Server-side Sentry init. Imported as the very first line of `server.ts` so it
// initializes before the request handler runs (serverless-friendly path — no
// `--import` flag, which doesn't apply to Vercel/Nitro functions).
// `import.meta.env.VITE_SENTRY_DSN` is inlined into the server bundle at build
// time by Vite, so it needs no runtime env lookup.
//
// Deliberately lean, because this runs on every cold start and cold starts
// dominate this function's billed Active CPU. The default Node setup registers
// the OpenTelemetry auto-instrumentations and an `import-in-the-middle` ESM
// loader hook, which routes every subsequent `import` through a worker-thread
// round trip — a large share of cold-start CPU here. `captureException` needs
// none of it: `apiError.server.ts`, `shortUrlRedirect.ts` and the
// `sentryGlobal*` middlewares in `start.ts` all report explicitly rather than
// relying on auto-instrumentation, so error reporting is unaffected.
//
// The cost of this: no server-side performance tracing and less automatic
// context (no `linkedErrors`/`requestData` integrations). Errors still arrive.
//
// `tracesSampleRate` is deliberately absent rather than `0`: Sentry treats any
// non-nullish value as "spans enabled" and then samples none, so omitting it
// turns tracing off outright instead of keeping the machinery on for nothing.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Only send to Sentry in production builds — no-op during `yarn dev`.
  enabled: import.meta.env.PROD,
  enableLogs: true,
  defaultIntegrations: false,
  registerEsmLoaderHooks: false,
});
