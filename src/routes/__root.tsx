import {useEffect, useRef, type ReactNode} from 'react';
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  useRouter,
} from '@tanstack/react-router';
import {Box, ChakraProvider, Flex} from '@chakra-ui/react';
import ProgressBar from '@badrap/bar-of-progress';
import theme from '../theme';

import Footer from '../components/Footer/Footer';
import Header from '../components/Header/Header';
import photoswipeCSS from 'photoswipe/dist/photoswipe.css?url';
import {dateStringComponents} from '../components/DateString';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {seo} from '../utils/seo';
import {loadEvent} from '../server/routes/__root';

export const Route = createRootRoute({
  head: ({match: {context}}) => {
    let title = 'Kulturspektakel Gauting';
    let description =
      'Open-Air-Musikfestival mit freiem Eintritt, Workshops, Kinderprogramm und mehr';
    if (context.event) {
      const {
        date,
        connector = '',
        to = '',
      } = dateStringComponents({
        date: context.event.start,
        to: context.event.end,
        until: '-',
      });
      title = `${title} ${date}${connector}${to}`;
      description = `Open-Air-Musikfestival vom ${date} bis ${to} mit freiem Eintritt, Workshops, Kinderprogramm und mehr`;
    }

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
  beforeLoad: () => loadEvent(),
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
    // Native Navigation API for browser tab spinner (Chromium)
    if (typeof window !== 'undefined' && 'navigation' in window) {
      const handler = (event: NavigateEvent) => {
        if (!event.canIntercept) return;
        event.intercept({
          handler: () =>
            new Promise<void>((resolve) => {
              const unsub = router.subscribe('onResolved', () => {
                unsub();
                resolve();
              });
            }),
        });
      };
      navigation.addEventListener('navigate', handler);
      return () => navigation.removeEventListener('navigate', handler);
    }
  }, [router]);

  useEffect(() => {
    const unsubBefore = router.subscribe('onBeforeNavigate', () => {
      if (typeof window !== 'undefined') {
        progressBar.current?.finish();
        progressBar.current = new ProgressBar();
        progressBar.current.start();
      }
    });

    const unsubRendered = router.subscribe('onRendered', () => {
      if (typeof window !== 'undefined') {
        progressBar.current?.finish();
        progressBar.current = null;
      }
    });

    return () => {
      unsubBefore();
      unsubRendered();
    };
  }, [router]);

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

