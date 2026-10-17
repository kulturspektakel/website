import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/tanstackstart-react';
import {useRouter, useRouterState} from '@tanstack/react-router';
import {
  Box,
  Button,
  Code,
  Container,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import {CopyToClipboard} from './CopyToClipboard';

/**
 * Error view for /crew/*. Unlike the public site's `Error`, the audience here is
 * the crew — people who can report or fix the problem — so it shows what went
 * wrong: the error's name, message, stack and `cause` chain, the URL, and the
 * Sentry event id to look it up by.
 *
 * Renders bare: it relies on the surrounding `ChakraProvider` (see `crew.tsx`).
 */
export function CrewError({
  error,
  reset,
}: {
  error: unknown;
  reset?: () => void;
}) {
  const router = useRouter();
  const href = useRouterState({select: (s) => s.location.href});
  const [eventId, setEventId] = useState<string>();

  useEffect(() => {
    if (error) {
      setEventId(Sentry.captureException(error));
    }
  }, [error]);

  const chain = errorChain(error);
  const report = [
    `URL: ${href}`,
    eventId && `Sentry: ${eventId}`,
    ...chain.map(
      (e, i) =>
        `${i > 0 ? 'Caused by: ' : ''}${e.stack ?? `${e.name}: ${e.message}`}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <Container maxW="4xl" py="8">
      <Stack gap="4">
        <Heading size="xl">Fehler</Heading>
        <Text>
          {chain[0].name}: {chain[0].message || '(keine Nachricht)'}
        </Text>
        <Stack gap="1" fontSize="sm" color="fg.muted">
          <Text>
            URL: <Code>{href}</Code>
          </Text>
          {eventId && (
            <Text>
              Sentry-Event: <Code>{eventId}</Code>
            </Text>
          )}
        </Stack>
        {chain.map((e, i) => (
          <Box key={i}>
            {i > 0 && (
              <Text fontSize="sm" fontWeight="semibold" mb="1">
                Ursache: {e.name}: {e.message}
              </Text>
            )}
            {e.stack && (
              <Code
                as="pre"
                display="block"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                p="3"
                fontSize="xs"
                maxH="60vh"
                overflow="auto"
              >
                {e.stack}
              </Code>
            )}
          </Box>
        ))}
        <HStack>
          <Button
            onClick={() => {
              // `reset` only clears the boundary; invalidating re-runs the
              // loaders so a failed fetch actually gets retried.
              reset?.();
              router.invalidate();
            }}
          >
            Erneut versuchen
          </Button>
          <CopyToClipboard text={report}>
            <Button as="span" variant="outline">
              Details kopieren
            </Button>
          </CopyToClipboard>
        </HStack>
      </Stack>
    </Container>
  );
}

/** The thrown value and its `cause`s, normalised to `Error`-like records. */
function errorChain(error: unknown) {
  const chain: Array<{name: string; message: string; stack?: string}> = [];
  let current = error;
  // Bounded in case of a cyclic `cause`.
  while (current != null && chain.length < 10) {
    if (current instanceof globalThis.Error) {
      chain.push({
        name: current.name,
        message: current.message,
        stack: current.stack,
      });
      current = current.cause;
    } else {
      chain.push({name: typeof current, message: safeStringify(current)});
      break;
    }
  }
  if (chain.length === 0) {
    chain.push({name: 'Error', message: String(error)});
  }
  return chain;
}

function safeStringify(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
