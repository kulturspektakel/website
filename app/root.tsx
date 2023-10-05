import {ApolloProvider} from '@apollo/client';
import {ChakraProvider, Box, Heading, Flex} from '@chakra-ui/react';
import type {LinksFunction, V2_MetaFunction} from '@remix-run/node';
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
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import theme from './theme';
import MetaPixel from './components/MetaPixel.client';
import {ClientOnly} from 'remix-utils';

export const meta: V2_MetaFunction = () => {
  return [
    {charset: 'utf-8'},
    {name: 'viewport', content: 'width=device-width,initial-scale=1'},
    {title: 'Kulturspektakel Gauting'},
    // {
    //   property: 'og:title',
    //   content: 'Very cool app',
    // },
    // {
    //   name: 'description',
    //   content: 'This app is the best',
    // },
  ];
};

export const links: LinksFunction = () => [
  {
    rel: 'stylesheet',
    href: '/fonts.css',
  },
  {
    rel: 'icon',
    type: 'image/png',
    href: '/favicon.png',
  },
];

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
          <ChakraProvider theme={theme}>
            <ApolloProvider client={apolloClient}>
              <Flex direction={'column'} minHeight={'100vh'}>
                <Header />
                <Box flex="1 1 0">{children}</Box>
                <Footer />
              </Flex>
            </ApolloProvider>
          </ChakraProvider>
        </CacheProvider>

        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <ClientOnly>{() => <MetaPixel />}</ClientOnly>
      </body>
    </html>
  );
}

export default function App() {
  // throw new Error('💣💥 Booooom');

  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function CatchBoundary() {
  // when true, this is what used to go to `CatchBoundary`

  return (
    <Document>
      <Box>
        <Heading as="h1">Uh oh ...</Heading>
        <p>Something went wrong.</p>
      </Box>
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <Document>
      <Heading as="h1">Oops</Heading>
      {isRouteErrorResponse(error) && (
        <>
          <p>Status: {error.status}</p>
          <p>{error.data.message}</p>
        </>
      )}
      {error instanceof Error && <p>{error.message}</p>}
    </Document>
  );
}
