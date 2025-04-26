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
import {createServerFn} from '@tanstack/react-start';
import {dateStringComponents} from '../components/DateString';
import {prismaClient} from '../utils/prismaClient';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

export const Route = createRootRouteWithContext<ApolloClientRouterContext>()({
  head: ({loaderData}) => {
    let title = 'Kulturspektakel Gauting';
    let description =
      'Open-Air-Musikfestival mit freiem Eintritt, Workshops, Kinderprogramm und mehr';
    if (loaderData) {
      const {
        date,
        connector = '',
        to = '',
      } = dateStringComponents({
        date: loaderData.start,
        to: loaderData.end,
        until: '-',
      });
      title = `Kulturspektakel Gauting ${date}${connector}${to}`;
      description = `Open-Air-Musikfestival vom ${date} bis ${to} mit freiem Eintritt, Workshops, Kinderprogramm und mehr`;
    }

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
  loader: async () => await rootLoader(),
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

const rootLoader = createServerFn().handler(async () => {
  const event = await prismaClient.event.findFirstOrThrow({
    where: {
      eventType: 'Kulturspektakel',
    },
    orderBy: {
      start: 'desc',
    },
    select: {
      start: true,
      end: true,
    },
  });

  return event;
});

function RootDoc({children}: Readonly<{children: ReactNode}>) {
  const event = Route.useLoaderData();
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        <ChakraProvider value={theme}>
          <Flex direction={'column'} minHeight={'100vh'}>
            <Header event={event} />
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
