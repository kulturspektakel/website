import {captureRemixErrorBoundaryError, withSentry} from '@sentry/remix';
import {ApolloProvider, gql} from '@apollo/client';
import {
  ChakraProvider,
  Box,
  Heading,
  Flex,
  Text,
  Image,
} from '@chakra-ui/react';
import type {
  LinksFunction,
  MetaFunction,
  LoaderFunctionArgs,
} from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useNavigation,
  useRouteError,
} from '@remix-run/react';
import apolloClient from './utils/apolloClient';
import {CacheProvider} from '@emotion/react';
import createEmotionCache from '@emotion/cache';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import theme from './theme';
import photoswipeCSS from 'photoswipe/dist/photoswipe.css';
import fontsCSS from '../public/fonts.css';
import {typedjson, useTypedRouteLoaderData} from 'remix-typedjson';
import {RootDocument} from './types/graphql';
import type {RootQuery} from './types/graphql';
import {dateStringComponents} from './components/DateString';
import logo from '../public/logos/logo.png';
import Headline from './components/Headline';
import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/remix';

export const meta: MetaFunction<typeof loader> = (props) => {
  let title = 'Kulturspektakel Gauting';
  let description =
    'Open-Air-Musikfestival mit freiem Eintritt, Workshops, Kinderprogramm und mehr';
  const event = props.data?.eventsConnection?.edges[0].node;
  if (event) {
    const {
      date,
      connector = '',
      to = '',
    } = dateStringComponents({
      date: new Date(event.start),
      to: new Date(event.end),
      until: '-',
    });
    title = `Kulturspektakel Gauting ${date}${connector}${to}`;
    description = `Open-Air-Musikfestival vom ${date} bis ${to} mit freiem Eintritt, Workshops, Kinderprogramm und mehr`;
  }

  return [
    {charset: 'utf-8'},
    {name: 'viewport', content: 'width=device-width,initial-scale=1'},
    {
      title,
    },
    {
      name: 'description',
      content: description,
    },
    {
      property: 'og:title',
      content: title,
    },
    {
      property: 'og:locale',
      content: 'de_DE',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      name: 'theme-color',
      content: theme.colors.offwhite[100],
    },
  ];
};

export const links: LinksFunction = () => [
  {
    rel: 'stylesheet',
    href: fontsCSS,
  },
  {
    rel: 'icon',
    type: 'image/png',
    href: '/favicon.png',
  },
  {rel: 'stylesheet', href: photoswipeCSS},
];

gql`
  query Root {
    eventsConnection(first: 1, type: Kulturspektakel) {
      edges {
        node {
          ...Header
        }
      }
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<RootQuery>({
    query: RootDocument,
  });
  let base = '';
  const url = new URL(args.request.url);
  if (
    url.hostname !== 'localhost' &&
    url.hostname !== 'www.kulturspektakel.de'
  ) {
    base = 'https://www.kulturspektakel.de';
  }
  return typedjson({...data, base});
}

function Document({
  children,
  base,
}: {
  children: React.ReactNode;
  base?: string;
}) {
  const emotionCache = createEmotionCache({key: 'css'});

  return (
    <html lang="de">
      <head>
        <Meta />
        <Links />
        {base && <base href={base} />}
      </head>
      <body>
        <CacheProvider value={emotionCache}>
          <ChakraProvider theme={theme}>
            <ApolloProvider client={apolloClient}>
              <Flex direction={'column'} minHeight={'100vh'}>
                <Header />
                <Box
                  flex="1 1 0"
                  ml="auto"
                  mr="auto"
                  maxW="3xl"
                  p="6"
                  pb="16"
                  width="100%"
                >
                  {children}
                </Box>
                <Footer />
                <Analytics />
                <SpeedInsights />
              </Flex>
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

function App() {
  const data = useTypedRouteLoaderData<typeof loader>('root');
  return (
    <Document base={data?.base}>
      <Outlet />
    </Document>
  );
}

export default withSentry(App);

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
  captureRemixErrorBoundaryError(error);

  return (
    <Document>
      {isRouteErrorResponse(error) && error.status == 404 ? (
        <>
          <Headline mb="4">Seite nicht gefunden</Headline>
          <Image
            src="/404.svg"
            alt="Trauriger Roboter der die Seite nicht finden konnte"
          />
        </>
      ) : (
        <>
          <Headline mb="4">Fehler</Headline>
          <Text>Da stimmt etwas nicht. Hast du es kaputt gemacht?</Text>
        </>
      )}
    </Document>
  );
}
