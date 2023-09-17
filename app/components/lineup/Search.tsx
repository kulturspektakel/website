import {
  Box,
  Center,
  Input,
  InputGroup,
  InputLeftElement,
  List,
  ListItem,
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
import {useCombobox} from 'downshift';
import {useNavigate} from '@remix-run/react';
import {$path} from 'remix-routes';

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

export default function Search() {
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
    <Box position="relative">
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <Search2Icon color="offwhite.300" />
        </InputLeftElement>
        <Input
          bgColor="white"
          borderRadius="full"
          placeholder="Suchen..."
          type="search"
          {...getInputProps({ref})}
        />
      </InputGroup>
      <List
        shadow="md"
        bg="white"
        borderRadius="lg"
        overflow="hidden"
        position="absolute"
        zIndex="2"
        mt="1"
        w="100%"
        visibility={isOpen ? 'visible' : 'hidden'}
        {...getMenuProps()}
      >
        {data.map((band, index) => (
          <ListItem
            key={band.id}
            {...getItemProps({item: band, index})}
            py="1.5"
            px="3"
            cursor="pointer"
            bg={index === highlightedIndex ? 'blue.500' : undefined}
            color={index === highlightedIndex ? 'white' : undefined}
          >
            {band.name} ({band.startTime.getFullYear()})
          </ListItem>
        ))}
        {loading && (
          <Center p="6">
            <Spinner size="sm" />
          </Center>
        )}
      </List>
    </Box>
  );
}
