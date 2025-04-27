import type {ReactNode} from 'react';
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import {Box, ChakraProvider, Flex} from '@chakra-ui/react';
import theme from '../theme';
import {type ApolloClientRouterContext} from '@apollo/client-integration-tanstack-start';
import Footer from '../components/Footer/Footer';
import Header from '../components/Header/Header';
import photoswipeCSS from 'photoswipe/dist/photoswipe.css?url';
import {dateStringComponents} from '../components/DateString';
import {prismaClient} from '../utils/prismaClient';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createServerFn} from '@tanstack/react-start';
import {wrapCreateRootRouteWithSentry} from '@sentry/tanstackstart-react';

const beforeLoad = createServerFn().handler(async () => {
  const event = await prismaClient.event.findFirstOrThrow({
    where: {
      eventType: 'Kulturspektakel',
    },
    orderBy: {
      start: 'desc',
    },
    select: {
      start: true,
      name: true,
      end: true,
      id: true,
      bandApplicationStart: true,
      bandApplicationEnd: true,
      djApplicationStart: true,
      djApplicationEnd: true,
    },
  });
  return {event};
});

export const Route = wrapCreateRootRouteWithSentry(
  createRootRouteWithContext<ApolloClientRouterContext>,
)()({
  head: ({match: {context}}) => {
    let title = 'Kulturspektakel Gauting';
    let description =
      'Open-Air-Musikfestival mit freiem Eintritt, Workshops, Kinderprogramm und mehr';
    const {
      date,
      connector = '',
      to = '',
    } = dateStringComponents({
      date: context.event.start,
      to: context.event.end,
      until: '-',
    });
    title = `Kulturspektakel Gauting ${date}${connector}${to}`;
    description = `Open-Air-Musikfestival vom ${date} bis ${to} mit freiem Eintritt, Workshops, Kinderprogramm und mehr`;

    return {
      meta: [
        {charSet: 'utf-8'},
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
      ],
      links: [
        {
          rel: 'stylesheet',
          href: photoswipeCSS,
        },
      ],
    };
  },
  component: RootComponent,
  beforeLoad: async () => await beforeLoad(),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
    },
  },
});

function RootComponent() {
  return (
    <RootDoc>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </RootDoc>
  );
}

function RootDoc({children}: Readonly<{children: ReactNode}>) {
  const context = Route.useRouteContext();
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        <ChakraProvider value={theme}>
          <Flex direction={'column'} minHeight={'100vh'}>
            <Header event={context.event} />
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
        </ChakraProvider>
        <Scripts />
      </body>
    </html>
  );
}
