import {useEffect, useRef} from 'react';
import {createFileRoute, Outlet, useRouter} from '@tanstack/react-router';
import {Box, ChakraProvider, Flex} from '@chakra-ui/react';
import ProgressBar from '@badrap/bar-of-progress';
import theme from '../theme';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import photoswipeCSS from 'photoswipe/dist/photoswipe.css?url';
import {dateStringComponents} from '../components/DateString';
import {seo} from '../utils/seo';
import {
  CURRENT_EVENT_STALE_TIME,
  currentEventQuery,
} from '../server/currentEvent';

export const Route = createFileRoute('/_main')({
  loader: ({context}) => context.queryClient.ensureQueryData(currentEventQuery),
  // Layout routes opt out of pending UI: `pendingComponent` replaces the route's own
  // component, which for a layout means its whole shell. The children below it have
  // their own pending views; this one just waits, as it always has.
  pendingMs: Infinity,
  // Without this the loader re-runs on every navigation. It would only ever be a
  // cache hit, but skipping it outright means the data hydrated from SSR is reused
  // as-is and a same-session visitor never re-fetches the event at all.
  staleTime: CURRENT_EVENT_STALE_TIME,
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
        date: loaderData.event.start,
        to: loaderData.event.end,
        until: '-',
      });
      title = `${title} ${date}${connector}${to}`;
      description = `Open-Air-Musikfestival vom ${date} bis ${to} mit freiem Eintritt, Workshops, Kinderprogramm und mehr`;
    }

    const {meta} = seo({title, description});

    return {
      meta: [
        ...meta,
        {property: 'og:locale', content: 'de_DE'},
        {name: 'og:type', content: 'website'},
      ],
      links: [
        {rel: 'stylesheet', href: photoswipeCSS},
        {rel: 'stylesheet', href: '/styles/fonts.css'},
        {rel: 'icon', href: '/logos/logo.png'},
      ],
    };
  },
  component: MainLayout,
});

function MainLayout() {
  const {event} = Route.useLoaderData();
  const router = useRouter();
  const progressBar = useRef<ProgressBar | null>(null);

  useEffect(() => {
    const unsubBefore = router.subscribe('onBeforeNavigate', () => {
      if (typeof window !== 'undefined') {
        progressBar.current?.finish();
        progressBar.current = new ProgressBar();
        progressBar.current.start();
      }
    });

    // `onResolved`, not `onRendered`: `onRendered` only fires when the resolved
    // href actually changes, while `onBeforeNavigate` fires on every load. So a
    // navigation that lands on the current URL started the bar and never
    // finished it, leaving it stuck until the next navigation. `onResolved`
    // fires on every pending -> idle edge, so it mirrors the start exactly.
    const unsubResolved = router.subscribe('onResolved', () => {
      if (typeof window !== 'undefined') {
        progressBar.current?.finish();
        progressBar.current = null;
      }
    });

    return () => {
      unsubBefore();
      unsubResolved();
    };
  }, [router]);

  return (
    <ChakraProvider value={theme}>
      <Flex direction="column" minHeight="100vh">
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
          <Outlet />
        </Box>
        <Footer />
      </Flex>
    </ChakraProvider>
  );
}
