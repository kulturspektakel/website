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
import Header from './components/Header/Header';

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

const theme = extendTheme({
  colors: {
    brand: {
      500: '#E12E2E',
      900: '#100A28',
    },
    red: {
      500: '#E12E2E',
    },
    offwhite: {
      100: '#f6f5f0',
      200: '#dbd8d3',
      300: '#d0cabc',
      400: '#b6b39f',
      500: '#9c9686',
      600: '#5a574e',
    },
  },
  fontWeights: {
    normal: 400,
    medium: 600,
    bold: 600,
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
      body: {
        bg: 'offwhite.100',
      },
      'h1,h2': {
        fontFamily: 'Shrimp !important',
        textTransform: 'uppercase',
      },
    },
  },
  components: {
    Steps,
    Form: {
      baseStyle: {
        helperText: {
          color: 'offwhite.600',
        },
      },
    },
    Heading: {
      baseStyle: {
        color: 'brand.900',
      },
    },
    Button: {
      baseStyle: {
        bg: 'offwhite.200',
      },
      variants: {
        primary: {
          bg: 'brand.900',
          color: 'white',
          _hover: {
            _disabled: {
              bg: 'brand.900',
            },
          },
        },
      },
      defaultProps: {
        variant: 'base',
      },
    },
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
