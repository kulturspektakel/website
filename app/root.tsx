import {ApolloProvider} from '@apollo/client';
import {ChakraProvider, Box, Heading} from '@chakra-ui/react';
import type {V2_MetaFunction} from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from '@remix-run/react';
import apolloClient from './utils/apolloClient';
import {CacheProvider} from '@emotion/react';
import createEmotionCache from '@emotion/cache';

export const meta: V2_MetaFunction = () => {
  return [
    {name: 'charset', content: 'utf-8'},
    {name: 'viewport', content: 'width=device-width,initial-scale=1'},
    {title: 'Very cool app | Remix'},
    {
      property: 'og:title',
      content: 'Very cool app',
    },
    {
      name: 'description',
      content: 'This app is the best',
    },
  ];
};

function Document({
  children,
  title = 'Kulturspektakel Gauting',
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const emotionCache = createEmotionCache({key: 'css'});

  return (
    <html lang="de">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <CacheProvider value={emotionCache}>
          <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
        </CacheProvider>

        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  // throw new Error('💣💥 Booooom');

  return (
    <Document>
      <ChakraProvider>
        <Outlet />
      </ChakraProvider>
    </Document>
  );
}

// How ChakraProvider should be used on CatchBoundary
export function CatchBoundary() {
  // when true, this is what used to go to `CatchBoundary`

  return (
    <Document>
      <ChakraProvider>
        <Box>
          <Heading as="h1" bg="purple.600">
            Uh oh ...
          </Heading>
          <p>Something went wrong.</p>
        </Box>
      </ChakraProvider>
    </Document>
  );
}

// How ChakraProvider should be used on ErrorBoundary
export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <Document>
      <ChakraProvider>
        <Heading as="h1" bg="purple.600">
          Oops
        </Heading>
        {isRouteErrorResponse(error) && (
          <>
            <p>Status: {error.status}</p>
            <p>{error.data.message}</p>
          </>
        )}
        {error instanceof Error && <p>{error.message}</p>}
      </ChakraProvider>
    </Document>
  );
}
