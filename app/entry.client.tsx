import {ApolloClient, ApolloProvider, InMemoryCache} from '@apollo/client';
import createEmotionCache from '@emotion/cache';
import {CacheProvider} from '@emotion/react';
import {RemixBrowser} from '@remix-run/react';
import {startTransition, StrictMode} from 'react';
import {hydrateRoot} from 'react-dom/client';
import apolloClient from './utils/apolloClient';

const hydrate = () => {
  const emotionCache = createEmotionCache({key: 'css'});

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <CacheProvider value={emotionCache}>
          <ApolloProvider client={apolloClient}>
            <RemixBrowser />
          </ApolloProvider>
        </CacheProvider>
      </StrictMode>,
    );
  });
};

if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(hydrate);
} else {
  // Safari doesn't support requestIdleCallback
  // https://caniuse.com/requestidlecallback
  setTimeout(hydrate, 1);
}
