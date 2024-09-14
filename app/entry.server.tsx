import type {EntryContext} from '@remix-run/node';
import {RemixServer} from '@remix-run/react';
import {renderToString} from 'react-dom/server';
import apolloClient from './utils/apolloClient';
import {getDataFromTree} from '@apollo/client/react/ssr';
import {createSitemapGenerator} from 'remix-sitemap';
import * as Sentry from '@sentry/remix';

const {isSitemapUrl, sitemap} = createSitemapGenerator({
  siteUrl: 'https://www.kulturspektakel.de',
  generateRobotsTxt: true,
});

Sentry.init({
  dsn: 'https://0a051473668a7010ad81176d2918a88f@o489311.ingest.us.sentry.io/4506423472422912',
  tracesSampleRate: 1,
  ignoreErrors: ['Non-Error exception captured'],
  enabled: process.env.NODE_ENV === 'production',
});

export const handleError = Sentry.sentryHandleError;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const url = new URL(request.url);
  if (
    url.hostname !== 'localhost' &&
    url.hostname !== 'www.kulturspektakel.de
  ) {
    url.hostname = 'www.kulturspektakel.de';
    return new Response('Redirecting...', {
      status: 301,
      headers: {
        Location: url.toString(),
      },
    });
  }

  if (isSitemapUrl(request)) {
    return await sitemap(request, remixContext);
  }

  const App = <RemixServer context={remixContext} url={request.url} />;
  await getDataFromTree(App);
  const initialState = apolloClient.extract();

  const markup = renderToString(
    <>
      {App}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__APOLLO_STATE__=${JSON.stringify(initialState)
            .replace(/</g, '\\u003c')
            .replace(
              /:("\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z")/g,
              ':new Date($1)',
            )}`, // The replace call escapes the < character to prevent cross-site scripting attacks that are possible via the presence of </script> in a string literal
        }}
      />
    </>,
  );

  responseHeaders.set('Content-Type', 'text/html');

  return new Response('<!DOCTYPE html>' + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
