import {gql} from '@apollo/client';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {useNavigate, useParams} from '@remix-run/react';
import {$params, $path} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import type {LineupBandQuery} from '~/types/graphql';
import {LineupBandDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';

gql`
  query LineupBand($id: ID!) {
    node(id: $id) {
      ... on BandPlaying {
        name
        shortDescription
        description
        photo {
          scaledUri(width: 800)
        }
      }
    }
  }
`;

export type SearchParams = {
  year: number;
  slug: string;
};

export async function loader(args: LoaderArgs) {
  const {year, slug} = $params('/lineup/:year/:slug', args.params);

  const {data} = await apolloClient.query<LineupBandQuery>({
    query: LineupBandDocument,
    variables: {
      id: `BandPlaying:lineup/${year}/${slug}`,
    },
  });

  return typedjson(data);
}

export default function LineupBand() {
  const data = useTypedLoaderData<typeof loader>();
  const {year} = useParams();
  const navigate = useNavigate();
  const band = data?.node?.__typename === 'BandPlaying' ? data.node : null;

  return (
    <Modal
      isOpen={true}
      onClose={() =>
        navigate($path('/lineup/:year', {year}), {preventScrollReset: true})
      }
    >
      <ModalOverlay />
      <ModalContent p="6">
        <ModalHeader>{band?.name}</ModalHeader>
        <ModalBody>{band?.shortDescription}</ModalBody>
      </ModalContent>
    </Modal>
  );
}
