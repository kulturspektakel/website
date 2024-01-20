import {gql, useApolloClient} from '@apollo/client';
import {
  Heading,
  Box,
  VStack,
  Input,
  Text,
  Button,
  Spinner,
  Divider,
} from '@chakra-ui/react';
import {useRef, useState} from 'react';
import {
  CheckNonceRequestDocument,
  useCreateNonceRequestMutation,
} from '~/types/graphql';
import mergeMeta from '~/utils/mergeMeta';
import {FaSlack} from 'react-icons/fa6';
import {useSearchParams} from '@remix-run/react';

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

export default function Sso() {
  const [requestNonce, {loading, data}] = useCreateNonceRequestMutation();
  const apolloClient = useApolloClient();
  const [email, setEmail] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [searchParams] = useSearchParams();

  return (
    <VStack spacing="10">
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
              spacing="2"
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
                      const url = new URL(
                        'https://api.kulturspektakel.de/saml/login',
                      );
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

            <Divider mt="10" mb="10" />

            <VStack
              as="form"
              w="100%"
              spacing="2"
              method="post"
              action={`https://api.kulturspektakel.de/saml/login?${searchParams.toString()}`}
            >
              <Heading as="h2" size="md">
                Passwort
              </Heading>
              <Text>
                Falls du keinen Slack-Account hast, frage jemanden aus der Crew
                nach dem Passwort für das Wiki.
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
          </>
        )}
      </Box>
    </VStack>
  );
}
