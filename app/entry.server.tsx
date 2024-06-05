import * as Sentry from '@sentry/remix';
import type {EntryContext, LoaderFunctionArgs} from '@remix-run/node';
import {RemixServer} from '@remix-run/react';
import {renderToString} from 'react-dom/server';
import apolloClient from './utils/apolloClient';
import {getDataFromTree} from '@apollo/client/react/ssr';
import {createSitemapGenerator} from 'remix-sitemap';

export function handleError(error: any, {request}: LoaderFunctionArgs) {
  Sentry.captureRemixServerException(
    error in error ? error.error : error,
    'remix.server',
    request,
  );
}

const {isSitemapUrl, sitemap} = createSitemapGenerator({
  siteUrl: 'https://www.kulturspektakel.de',
  generateRobotsTxt: true,
});

Sentry.init({
  dsn: 'https://0a051473668a7010ad81176d2918a88f@o489311.ingest.sentry.io/4506423472422912',
  tracesSampleRate: 1,
  ignoreErrors: ['Non-Error exception captured'],
  enabled: process.env.NODE_ENV === 'production',
});

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
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
