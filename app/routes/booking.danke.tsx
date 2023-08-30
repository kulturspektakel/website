import {gql} from '@apollo/client';
import {VStack, Heading, Text, Img} from '@chakra-ui/react';
import Confetti from '~/components/booking/Confetti';
import type {CreateBandApplicationMutation, ThanksQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {ActionArgs, LoaderArgs} from '@remix-run/node';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import {EVENT_ID} from './booking._index';
import {destroySession, getSession} from '~/components/booking/session.server';
import {Suspense} from 'react';
import DateString from '~/components/DateString';

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<ThanksQuery>({
    query: gql`
      query Thanks($id: ID!) {
        node(id: $id) {
          ... on Event {
            bandApplicationEnd
            djApplicationEnd
          }
        }
      }
    `,
    variables: {
      id: EVENT_ID,
    },
  });

  if (data.node?.__typename === 'Event') {
    return typedjson(data.node);
  }

  throw new Error(`Event ${EVENT_ID} not found`);
}

export const action = async ({request}: ActionArgs) => {
  const session = await getSession(request.headers.get('cookie'));
  const formData = Object.fromEntries(await request.formData()); // TODO: type

  const {errors} = await apolloClient.mutate<CreateBandApplicationMutation>({
    mutation: gql`
      mutation CreateBandApplication($data: CreateBandApplicationInput!) {
        createBandApplication(data: $data) {
          id
        }
      }
    `,
    variables: {
      data: formData,
    },
  });
  if (errors) {
    throw new Error(errors.at(0)?.message);
  }
  return typedjson(
    {isDJ: true},
    {
      headers: {
        'Set-Cookie': await destroySession(session),
      },
    },
  );
};

export default function Thanks() {
  const data = useTypedLoaderData<typeof loader>();
  const isDJ = useTypedActionData<typeof action>()?.isDJ;
  const applicationEnd = isDJ ? data.djApplicationEnd : data.bandApplicationEnd;

  return (
    <>
      <Suspense fallback={null}>
        <Confetti />
      </Suspense>
      <VStack spacing="5" textAlign="center">
        <Img src={isDJ ? '/genre/disco.svg' : '/genre/metal.svg'} width="16" />
        <Heading size="lg">
          Danke für {isDJ ? 'deine' : 'eure'} Bewerbung!
        </Heading>
        <Text>
          Wir haben dir soeben eine E-Mail zur Bestätigung geschickt. Wir
          beantworten jede Bewerbung, allerdings kann es bis nach dem
          Bewerbungsschluss am <DateString date={applicationEnd!} /> dauern, bis
          wir uns bei dir melden.
        </Text>
      </VStack>
    </>
  );
}
