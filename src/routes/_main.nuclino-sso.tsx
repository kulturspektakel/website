import {
  Heading,
  Box,
  VStack,
  Input,
  Text,
  Spinner,
  Separator,
  Button,
} from '@chakra-ui/react';
import {useState, useMemo} from 'react';
import {FaSlack} from 'react-icons/fa6';
import {createFileRoute, redirect} from '@tanstack/react-router';
import {useMutation, useQuery} from '@tanstack/react-query';
import {seo} from '../utils/seo';
import {createServerFn} from '@tanstack/react-start';
import {getCookie} from '@tanstack/react-start/server';
import {addMinutes} from 'date-fns';
import {prismaClient} from '../server/prismaClient.server';
import {enqueueGcpTask} from '../server/enqueueGcpTask.server';

const NONCE_LIFETIME_MINUTES = 5;

const beforeLoad = createServerFn()
  .inputValidator((query: Record<string, any>) => query)
  .handler(({data}) => {
    const nonce = getCookie('nonce');
    if (nonce) {
      const url = new URL(LOGIN_URL, process.env.SITE_URL);
      Object.entries(data).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      url.searchParams.set('nonce', nonce);
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

const createNonceRequest = createServerFn()
  .inputValidator((data: {email: string}) => data)
  .handler(async ({data}) => {
    const expiresAt = addMinutes(new Date(), NONCE_LIFETIME_MINUTES);
    const nonceRequest = await prismaClient.nonceRequest.create({
      data: {
        expiresAt,
        createdForEmail: data.email,
      },
    });

    await Promise.all([
      // Sends the Slack DM with approve/reject buttons.
      enqueueGcpTask('create-nonce-request', {
        id: nonceRequest.id,
        email: data.email,
      }),
      // Cleans up the row if the user never approves it.
      enqueueGcpTask(
        'nonce-request-invalidate',
        {nonceRequestId: nonceRequest.id},
        {scheduleAt: expiresAt},
      ),
    ]);

    return nonceRequest.id;
  });

const checkNonceRequest = createServerFn()
  .inputValidator((data: {nonceRequestId: string}) => data)
  .handler(async ({data}) => {
    const nonceRequest = await prismaClient.nonceRequest.findUnique({
      where: {
        id: data.nonceRequestId,
        expiresAt: {gt: new Date()},
        status: 'Approved',
      },
      include: {createdFor: true},
    });

    if (!nonceRequest) {
      return null;
    }

    const expiresAt = addMinutes(new Date(), NONCE_LIFETIME_MINUTES);
    const {nonce} = await prismaClient.nonce.create({
      data: {
        expiresAt,
        createdForId: nonceRequest.createdForId,
      },
    });
    await enqueueGcpTask('nonce-invalidate', {nonce}, {scheduleAt: expiresAt});

    return nonce;
  });

export const Route = createFileRoute('/_main/nuclino-sso')({
  component: Sso,
  validateSearch: (search): Record<string, any> => search,
  beforeLoad: async ({search}) => await beforeLoad({data: search}),
  head: () =>
    seo({
      title: 'Nuclino Login',
    }),
});

// Same-origin path to the SAML IdP login endpoint. Resolve against an origin
// (`window.location.origin` on the client, `SITE_URL` on the server) before use.
export const LOGIN_URL = '/api/saml/login';

function NonceChecker({requestId}: {requestId: string}) {
  const search = Route.useSearch()!;

  useQuery({
    queryKey: ['nonceRequest', requestId],
    queryFn: async () => {
      const nonce = await checkNonceRequest({
        data: {nonceRequestId: requestId},
      });
      if (!nonce) {
        return null;
      }
      const url = new URL(LOGIN_URL, window.location.origin);
      Object.entries(search).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      url.searchParams.set('nonce', nonce);
      window.location.href = url.toString();
      return nonce;
    },
    refetchInterval: (query) => (query.state.data ? false : 500),
  });

  return (
    <Box mt="2">
      <Button
        onClick={async () => {
          const nonce = await checkNonceRequest({
            data: {nonceRequestId: requestId},
          });
          if (nonce) {
            const url = new URL(LOGIN_URL, window.location.origin);
            Object.entries(search).forEach(([key, value]) =>
              url.searchParams.set(key, value),
            );
            url.searchParams.set('nonce', nonce);
            window.location.href = url.toString();
          }
        }}
      >
        Einloggen
      </Button>
    </Box>
  );
}

function Sso() {
  const [email, setEmail] = useState('');
  const search = Route.useSearch();
  const searchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (search) {
      Object.entries(search).forEach(([key, value]) =>
        searchParams.set(key, value),
      );
    }
    return searchParams;
  }, [search]);

  const {
    isPending,
    data: nonceRequestId,
    mutate,
  } = useMutation({
    mutationFn: (email: string) => createNonceRequest({data: {email}}),
  });

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
            <NonceChecker requestId={nonceRequestId} />
          </Box>
        ) : (
          <>
            <VStack
              as="form"
              w="100%"
              gap="2"
              onSubmit={(e) => {
                e.preventDefault();
                mutate(email);
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
                loading={isPending}
                disabled={Boolean(nonceRequestId)}
              >
                Einloggen
              </Button>
            </VStack>

            <Separator mt="10" mb="10" />

            <form
              method="post"
              action={`${LOGIN_URL}?${searchParams.toString()}`}
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
