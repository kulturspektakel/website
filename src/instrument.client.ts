import * as Sentry from '@sentry/tanstackstart-react';

// Browser-side Sentry init. Loaded as the very first import in `client.tsx` so
// it wraps everything that follows. Router browser-tracing is added separately
// in `router.tsx` (it needs the router instance). No Session Replay / feedback
// widget by choice (GDPR / data volume).
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Only send to Sentry in production builds — no-op during `yarn dev`.
  enabled: import.meta.env.PROD,
  enableLogs: true,
  tracesSampleRate: 0.1,
});
