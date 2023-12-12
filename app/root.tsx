import {ApolloProvider, gql} from '@apollo/client';
import {ChakraProvider, Box, Heading, Flex} from '@chakra-ui/react';
import type {LinksFunction, LoaderArgs, V2_MetaFunction} from '@remix-run/node';
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
import photoswipeCSS from 'photoswipe/dist/photoswipe.css';
import fontsCSS from '../public/fonts.css';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import {RootDocument} from './types/graphql';
import type {RootQuery} from './types/graphql';
import {dateStringComponents} from './components/DateString';
import logo from '../public/logos/logo.png';

export const meta: V2_MetaFunction<typeof loader> = (props) => {
  const {
    date,
    connector = '',
    to = '',
  } = dateStringComponents({
    date: props.data.eventsConnection.edges[0].node.start,
    to: props.data.eventsConnection.edges[0].node.end,
    until: '-',
  });

  const title = `Kulturspektakel Gauting ${date}${connector}${to}`;
  const description = `Das Kulturspektakel Gauting ist ein Kulturfestival in Gauting. Es findet vom ${date} bis ${to} statt.`;
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
      property: 'og:image',
      content: `https://kulturspektakel.de${logo}`,
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
    ...Header
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<RootQuery>({
    query: RootDocument,
  });
  return typedjson(data);
}

function Document({children}: {children: React.ReactNode}) {
  const emotionCache = createEmotionCache({key: 'css'});
  const data = useTypedLoaderData<typeof loader>();

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
                <Header data={data} />
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
