import {
  Box,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuItem,
  MenuList,
  Spinner,
} from '@chakra-ui/react';
import {gql} from '@apollo/client';
import type {BandSearchQuery} from '~/types/graphql';
import {BandSearchDocument} from '~/types/graphql';
import {} from 'tomo-typeahead';
import {useTypeahead} from 'tomo-typeahead/react';
import apolloClient from '~/utils/apolloClient';
import {Search2Icon} from '@chakra-ui/icons';
import {useRef} from 'react';

gql`
  query BandSearch($query: String!, $limit: Int = 5) {
    findBandPlaying(query: $query, limit: $limit) {
      id
      name
      startTime
    }
  }
`;

export default function Search({onSelect}: {onSelect: any}) {
  const {loading, data, setQuery} = useTypeahead<
    BandSearchQuery['findBandPlaying'][number]
  >({
    fetcher: async (query) => {
      const {data} = await apolloClient.query({
        query: BandSearchDocument,
        variables: {
          query,
        },
      });
      return data.findBandPlaying;
    },
    keyExtractor: (item) => item.id,
    matchStringExtractor: (item) => item.name,
  });

  const ref = useRef<HTMLInputElement>(null);

  return (
    <Box position="relative">
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <Search2Icon color="offwhite.300" />
        </InputLeftElement>
        <Input
          ref={ref}
          bgColor="white"
          borderRadius="full"
          placeholder="Suchen..."
          type="search"
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      <Menu isOpen={true} initialFocusRef={ref}>
        {loading && <Spinner />}
        <MenuList>
          {data.map((band) => (
            <MenuItem key={band.id}>
              {band.name} ({band.startTime.getFullYear()})
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    </Box>
  );
}
