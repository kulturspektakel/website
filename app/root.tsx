import {ApolloProvider} from '@apollo/client';
import {ChakraProvider, Box, Heading, extendTheme} from '@chakra-ui/react';
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
import {StepsTheme as Steps} from 'chakra-ui-steps';
import SpaceGrotesk400 from '@fontsource/space-grotesk/latin-400.css';
import Header from './components/Header';

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

export const links: LinksFunction = () => [
  {
    rel: 'stylesheet',
    href: SpaceGrotesk400,
  },
  {
    rel: 'stylesheet',
    href: '/shrimp-webfont.css',
  },
];

const theme = extendTheme({
  colors: {
    brand: {
      100: '#f7fafc',
      // ...
      900: '#1a202c',
    },
  },
  fonts: {
    heading: "'Space Grotesk', sans-serif;",
    body: "'Space Grotesk', sans-serif;",
  },
  styles: {
    global: {
      html: {
        WebkitFontSmoothing: 'auto',
        fontSynthesis: 'none',
      },
      'h1,h2': {
        fontFamily: 'Shrimp !important',
        textTransform: 'uppercase',
      },
    },
  },
  components: {
    Steps,
  },
});

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
              <Header />
              {children}
            </ApolloProvider>
          </ChakraProvider>
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
      <Outlet />
    </Document>
  );
}

// How ChakraProvider should be used on CatchBoundary
export function CatchBoundary() {
  // when true, this is what used to go to `CatchBoundary`

  return (
    <Document>
      <Box>
        <Heading as="h1" bg="purple.600">
          Uh oh ...
        </Heading>
        <p>Something went wrong.</p>
      </Box>
    </Document>
  );
}

// How ChakraProvider should be used on ErrorBoundary
export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <Document>
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
    </Document>
  );
}
