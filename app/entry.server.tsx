import {PassThrough} from 'stream';
import createEmotionCache from '@emotion/cache';
import {CacheProvider as EmotionCacheProvider} from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import type {AppLoadContext, EntryContext} from '@remix-run/node';
import {Response} from '@remix-run/node';
import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToPipeableStream} from 'react-dom/server';

const ABORT_DELAY = 5000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  loadContext: AppLoadContext,
) {
  return new Promise((resolve, reject) => {
    let didError = false;
    const emotionCache = createEmotionCache({key: 'css'});

    const {pipe, abort} = renderToPipeableStream(
      <EmotionCacheProvider value={emotionCache}>
        <RemixServer context={remixContext} url={request.url} />
      </EmotionCacheProvider>,
      {
        [isbot(request.headers.get('user-agent'))
          ? 'onAllReady'
          : 'onShellReady']: () => {
          const reactBody = new PassThrough();
          const emotionServer = createEmotionServer(emotionCache);
          const bodyWithStyles = emotionServer.renderStylesToNodeStream();
          reactBody.pipe(bodyWithStyles);

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(bodyWithStyles, {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            }),
          );

          pipe(reactBody);
        },
        onShellError: (error: unknown) => {
          reject(error);
        },
        onError: (error: unknown) => {
          didError = true;

          console.error(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}