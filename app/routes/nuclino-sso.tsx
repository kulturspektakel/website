import {gql, useApolloClient} from '@apollo/client';
import {
  Heading,
  Box,
  VStack,
  Input,
  Text,
  Spinner,
  Separator,
} from '@chakra-ui/react';
import {useRef, useState, useEffect, useCallback, useMemo} from 'react';

import {FaSlack} from 'react-icons/fa6';
import {Button} from '../components/chakra-snippets/button';
import {createFileRoute, redirect} from '@tanstack/react-router';
import {getWebRequest} from '@tanstack/react-start/server';
import {
  CheckNonceRequestDocument,
  useCreateNonceRequestMutation,
} from '../types/graphql';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';

gql`
  mutation CreateNonceRequest($email: String!) {
    createNonceRequest(email: $email)
  }

  mutation CheckNonceRequest($nonceRequestId: String!) {
    nonceFromRequest(nonceRequestId: $nonceRequestId)
  }
`;

type SearchParams =
  | {
      SAMLRequest: string;
      RelayState: string;
    }
  | {};

const beforeLoad = createServerFn()
  .validator((search: SearchParams) => search)
  .handler(({data}) => {
    const request = getWebRequest();
    const cookies = request?.headers.get('Cookie') ?? '';
    const match = cookies.match(/(?:^|;\s*)nonce=([^;]*)/);
    if (request && match && match?.length > 1) {
      const url = new URL(LOGIN_URL);
      new URL(request.url).searchParams.forEach((value, key) =>
        url.searchParams.set(key, value),
      );
      url.searchParams.set('nonce', match[1]);
      throw redirect({
        href: url.toString(),
      });
    }
    if (!data['SAMLRequest']) {
      throw redirect({
        href: 'https://app.nuclino.com/Kulturspektakel/login',
      });
    }
  });

export const Route = createFileRoute('/nuclino-sso')({
  component: Sso,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    if (
      typeof search['SAMLRequest'] === 'string' &&
      typeof search['RelayState'] === 'string'
    ) {
      return {
        SAMLRequest: search['SAMLRequest'],
        RelayState: search['RelayState'],
      };
    }
    return {};
  },
  beforeLoad: async ({search}) => await beforeLoad({data: search}),
  head: () =>
    seo({
      title: 'Nuclino Login',
    }),
});

const LOGIN_URL = 'https://api.kulturspektakel.de/saml/login';

function usePolling(asyncFn: () => Promise<boolean>, delay: number) {
  const isPolling = useRef(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const executePolling = async () => {
      if (isPolling.current) return;

      isPolling.current = true;
      try {
        const result = await asyncFn();
        if (!result) {
          timeoutId = setTimeout(executePolling, delay);
        }
      } finally {
        isPolling.current = false;
      }
    };

    executePolling();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [asyncFn, delay, isPolling]);
}

function NonceChecker({
  requestId,
  searchParams,
}: {
  requestId: string;
  searchParams: URLSearchParams;
}) {
  const apolloClient = useApolloClient();
  const search = Route.useSearch()!;
  const checkNonceRequest = useCallback(async () => {
    const {data: d} = await apolloClient.mutate({
      mutation: CheckNonceRequestDocument,
      variables: {
        nonceRequestId: requestId,
      },
    });
    if (!d?.nonceFromRequest) {
      return false;
    }
    const url = new URL(LOGIN_URL);
    searchParams.forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set('nonce', d.nonceFromRequest);
    window.location.href = url.toString();
    return true;
  }, [requestId, search]);

  usePolling(checkNonceRequest, 500);
  return (
    <Box mt="2">
      <Button onClick={checkNonceRequest}>Einloggen</Button>
    </Box>
  );
}

function Sso() {
  const [requestNonce, {loading, data}] = useCreateNonceRequestMutation();
  const [email, setEmail] = useState('');
  const search = Route.useSearch();
  const searchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    Object.entries(search).forEach(([key, value]) =>
      searchParams.set(key, value),
    );
    return searchParams;
  }, [search]);

  const nonceRequestId = data?.createNonceRequest;

  return (
    <VStack gap="10">
      <Heading size="3xl" as="h1" textAlign="center">
        Nuclino Login
      </Heading>

      <Box my="auto" maxW="400px">
        {nonceRequestId ? (
          <Box textAlign="center">
            <Spinner mt="5" mb="5" />
            <Text>Bestätige deinen Login in der Slack-App</Text>
            <NonceChecker
              requestId={nonceRequestId}
              searchParams={searchParams}
            />
          </Box>
        ) : (
          <>
            <VStack
              as="form"
              w="100%"
              gap="2"
              onSubmit={(e) => {
                e.preventDefault();
                return requestNonce({
                  variables: {
                    email,
                  },
                });
              }}
            >
              <Heading as="h2" size="xl">
                <FaSlack style={{display: 'inline-block', marginTop: -4}} />
                &nbsp;Slack
              </Heading>
              <Text>
                Gib deine E-Mailaddresse ein, mit der du bei Slack registriert
                bist und bestätige deinen Login in der Slack-App.
              </Text>

              <Input
                placeholder="Slack E-Mailadresse"
                type="email"
                value={email}
                bg="white"
                w="100%"
                onChange={(e) => setEmail(e.target.value.trim())}
              />
              <Button
                w="full"
                type="submit"
                loading={loading}
                disabled={Boolean(data?.createNonceRequest)}
              >
                Einloggen
              </Button>
            </VStack>

            <Separator mt="10" mb="10" />

            <form
              method="post"
              action={`https://api.kulturspektakel.de/saml/login?${searchParams.toString()}`}
            >
              <VStack w="100%" gap="2">
                <Heading as="h2" size="xl">
                  Passwort
                </Heading>
                <Text>
                  Falls du keinen Slack-Account hast, frage jemanden aus der
                  Crew nach dem Passwort für das Wiki.
                </Text>
                <Input
                  display="block"
                  placeholder="Passwort"
                  type="password"
                  bg="white"
                  name="password"
                />
                <Button w="full" type="submit">
                  Einloggen
                </Button>
              </VStack>
            </form>
          </>
        )}
      </Box>
    </VStack>
  );
}
