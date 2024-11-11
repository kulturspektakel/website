import {gql, useApolloClient} from '@apollo/client';
import {
  Heading,
  Box,
  VStack,
  Input,
  Text,
  Button,
  Spinner,
  Separator,
} from '@chakra-ui/react';
import {useRef, useState} from 'react';
import {
  CheckNonceRequestDocument,
  useCreateNonceRequestMutation,
} from '~/types/graphql';
import mergeMeta from '~/utils/mergeMeta';
import {FaSlack} from 'react-icons/fa6';
import {useSearchParams} from '@remix-run/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {redirect} from '@remix-run/node';

gql`
  mutation CreateNonceRequest($email: String!) {
    createNonceRequest(email: $email)
  }

  mutation CheckNonceRequest($nonceRequestId: String!) {
    nonceFromRequest(nonceRequestId: $nonceRequestId)
  }
`;

export const meta = mergeMeta(({data, params}) => {
  return [
    {
      title: 'Nuclino Login',
    },
  ];
});

const LOGIN_URL = 'https://api.kulturspektakel.de/saml/login';

export async function loader({request}: LoaderFunctionArgs) {
  const cookies = request.headers.get('Cookie') ?? '';
  const match = cookies.match(/(?:^|;\s*)nonce=([^;]*)/);
  if (match && match?.length > 1) {
    const url = new URL(LOGIN_URL);
    new URL(request.url).searchParams.forEach((value, key) =>
      url.searchParams.set(key, value),
    );
    url.searchParams.set('nonce', match[1]);
    console.log(url);
    return redirect(url.toString());
  }
  return null;
}

export default function Sso() {
  const [requestNonce, {loading, data}] = useCreateNonceRequestMutation();
  const apolloClient = useApolloClient();
  const [email, setEmail] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [searchParams] = useSearchParams();

  return (
    <VStack gap="10">
      <Heading as="h1" textAlign="center">
        Nuclino Login
      </Heading>

      <Box my="auto" maxW="400px">
        {data?.createNonceRequest ? (
          <Box textAlign="center">
            <Spinner mt="5" mb="5" />
            <Text>Bestätige deinen Login in der Slack-App</Text>
          </Box>
        ) : (
          <>
            <VStack
              as="form"
              w="100%"
              gap="2"
              onSubmit={(e) => {
                e.preventDefault();
                requestNonce({
                  variables: {
                    email,
                  },
                }).then(({data}) => {
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                  }
                  if (!data?.createNonceRequest) {
                    return;
                  }

                  let counter = 0;

                  const checkNonceRequest = async () => {
                    counter++;
                    if (counter > 600) {
                      return;
                    }
                    const {data: d} = await apolloClient.mutate({
                      mutation: CheckNonceRequestDocument,
                      variables: {
                        nonceRequestId: data.createNonceRequest,
                      },
                    });
                    if (d?.nonceFromRequest) {
                      const url = new URL(LOGIN_URL);
                      searchParams.forEach((value, key) =>
                        url.searchParams.set(key, value),
                      );
                      url.searchParams.set('nonce', d.nonceFromRequest);
                      window.location.href = url.toString();
                    } else {
                      timeoutRef.current = setTimeout(checkNonceRequest, 500);
                    }
                  };

                  timeoutRef.current = setTimeout(checkNonceRequest, 500);
                });
              }}
            >
              <Heading as="h2" size="md">
                <FaSlack style={{display: 'inline-block', marginBottom: -2}} />
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
                w="100%"
                type="submit"
                isLoading={loading}
                variant="primary"
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
                <Heading as="h2" size="md">
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
                <Button w="100%" type="submit" variant="primary">
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
