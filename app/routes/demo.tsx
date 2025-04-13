import {createFileRoute, useRouter} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {Button} from '@chakra-ui/react';
import {useRootSuspenseQuery} from '../types/graphql';
import {gql} from '@apollo/client/index.js';

async function readCount() {
  return new Date();
}

const getCount = createServerFn({
  method: 'GET',
}).handler(readCount);

export const Route = createFileRoute('/demo')({
  component: Home,
  loader: async () => await getCount(),
});

gql`
  query Root {
    eventsConnection(first: 1, type: Kulturspektakel) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

function Home() {
  const router = useRouter();
  const state = Route.useLoaderData();
  const {data} = useRootSuspenseQuery();
  console.log(state.getFullYear());

  return (
    <Button type="button">
      Add 1 to {data?.eventsConnection?.edges?.[0]?.node?.name}?
    </Button>
  );
}
