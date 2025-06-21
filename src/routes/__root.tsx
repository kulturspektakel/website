import {useEffect, useRef, type ReactNode} from 'react';
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import {Box, ChakraProvider, Flex, Spinner} from '@chakra-ui/react';
import theme from '../theme';
import {type ApolloClientRouterContext} from '@apollo/client-integration-tanstack-start';
import Footer from '../components/Footer/Footer';
import Header from '../components/Header/Header';
import photoswipeCSS from 'photoswipe/dist/photoswipe.css?url';
import {dateStringComponents} from '../components/DateString';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createServerFn} from '@tanstack/react-start';
import {wrapCreateRootRouteWithSentry} from '@sentry/tanstackstart-react';
import {seo} from '../utils/seo';
import ProgressBar from '@badrap/bar-of-progress';
import {getCurrentEvent} from '../utils/getCurrentEvent';

const beforeLoad = createServerFn({type: 'static'}).handler(async () => ({
  event: await getCurrentEvent(),
}));

export const Route = wrapCreateRootRouteWithSentry(
  createRootRouteWithContext<
    ApolloClientRouterContext & Awaited<ReturnType<typeof beforeLoad>>
  >,
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

    const {meta} = seo({title, description});

    return {
      meta: [
        ...meta,
        {charSet: 'utf-8'},
        {name: 'viewport', content: 'width=device-width,initial-scale=1'},
        {
          property: 'og:locale',
          content: 'de_DE',
        },
        {name: 'og:type', content: 'website'},
      ],
      links: [
        {
          rel: 'stylesheet',
          href: photoswipeCSS,
        },
        {
          rel: 'stylesheet',
          href: '/styles/fonts.css',
        },
        {
          rel: 'icon',
          href: '/logos/logo.png',
        },
      ],
    };
  },
  component: RootComponent,
  beforeLoad: async ({location}) => {
    const match = location.pathname.match(
      /^\/\$([\$c])\/([A-Za-z0-9\-_]+)\/?$/,
    );

    if (match && match.length == 3) {
      throw redirect(
        match[1] === 'c'
          ? {
              to: '/card/$hash/crew',
              params: {
                hash: match[2],
              },
            }
          : {
              to: '/card/$hash/kult',
              params: {
                hash: match[2],
              },
            },
      );
    }

    return await beforeLoad();
  },
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
  const router = useRouter();
  const progressBar = useRef<ProgressBar | null>(null);

  useEffect(() => {
    router.subscribe('onBeforeNavigate', () => {
      if (typeof window !== 'undefined') {
        progressBar.current?.finish();
        progressBar.current = new ProgressBar();
        progressBar.current.start();
      }
    });

    router.subscribe('onRendered', () => {
      if (typeof window !== 'undefined') {
        progressBar.current?.finish();
        progressBar.current = null;
      }
    });
  }, [router, progressBar]);

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
