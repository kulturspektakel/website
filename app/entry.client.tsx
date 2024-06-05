import * as Sentry from '@sentry/remix';
import {RemixBrowser, useLocation, useMatches} from '@remix-run/react';
import {startTransition, useEffect} from 'react';
import {hydrateRoot} from 'react-dom/client';

Sentry.init({
  dsn: 'https://0a051473668a7010ad81176d2918a88f@o489311.ingest.sentry.io/4506423472422912',
  tracesSampleRate: 1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  enabled: process.env.NODE_ENV === 'production',
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.remixRouterInstrumentation(
        useEffect,
        useLocation,
        useMatches,
      ),
    }),
    new Sentry.Replay(),
  ],
});

const hydrate = () => {
  startTransition(() => {
    hydrateRoot(document, <RemixBrowser />);
  });
};

if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(hydrate);
} else {
  // Safari doesn't support requestIdleCallback
  // https://caniuse.com/requestidlecallback
  setTimeout(hydrate, 1);
}
