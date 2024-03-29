import type {BoxProps} from '@chakra-ui/react';
import {Box, Input, InputGroup, InputLeftElement, Text} from '@chakra-ui/react';
import {gql} from '@apollo/client';
import type {BandSearchQuery} from '~/types/graphql';
import {BandSearchDocument} from '~/types/graphql';
import {useTypeahead} from 'tomo-typeahead/react';
import apolloClient from '~/utils/apolloClient';
import {Search2Icon} from '@chakra-ui/icons';
import {useRef} from 'react';
import {useCombobox} from 'downshift';
import {useNavigate} from '@remix-run/react';
import {$path} from 'remix-routes';
import DropdownMenu from '../DropdownMenu';

gql`
  query BandSearch($query: String!, $limit: Int = 5) {
    findBandPlaying(query: $query, limit: $limit) {
      id
      name
      startTime
      slug
    }
  }
`;

export default function Search(props: BoxProps) {
  const {loading, data, setQuery} = useTypeahead<
    BandSearchQuery['findBandPlaying'][number]
  >({
    fetcher: async (query) => {
      const {data: d} = await apolloClient.query({
        query: BandSearchDocument,
        variables: {
          query,
        },
      });
      return d.findBandPlaying;
    },
    keyExtractor: (item) => item.id,
    matchStringExtractor: (item) => item.name,
  });

  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement>(null);

  const {isOpen, highlightedIndex, getInputProps, getItemProps, getMenuProps} =
    useCombobox({
      items: data,
      itemToString: (band) => band?.name ?? '',
      stateReducer: (_state, {type, changes}) => {
        if (
          type === useCombobox.stateChangeTypes.ItemClick ||
          type === useCombobox.stateChangeTypes.InputKeyDownEnter
        ) {
          changes.inputValue = '';
        }
        return changes;
      },
      onInputValueChange: (e) => setQuery(e.inputValue ?? ''),
      onSelectedItemChange: ({selectedItem}) => {
        if (selectedItem) {
          navigate(
            $path('/lineup/:year/:slug', {
              year: selectedItem.startTime.getFullYear(),
              slug: selectedItem.slug,
            }),
          );
          ref.current?.blur();
        }
      },
    });

  return (
    <Box position="relative" {...props}>
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <Search2Icon color="offwhite.300" />
        </InputLeftElement>
        <Input
          bgColor="white"
          borderRadius="full"
          placeholder="Bands suchen..."
          type="search"
          {...getInputProps({ref})}
        />
      </InputGroup>
      <DropdownMenu
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
        isOpen={isOpen}
        loading={loading}
        data={data}
        highlightedIndex={highlightedIndex}
        itemRenderer={(band) => (
          <Text noOfLines={1}>
            {band.name} ({band.startTime.getFullYear()})
          </Text>
        )}
        keyExtractor={(band) => band.id}
      />
    </Box>
  );
}
