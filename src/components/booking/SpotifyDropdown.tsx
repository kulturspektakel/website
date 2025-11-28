import {Text, HStack, VStack, IconButton, Input, Box} from '@chakra-ui/react';
import {Field as FormikField} from 'formik';
import {useFormikContext} from 'formik';
import {useTypeahead} from 'tomo-typeahead/react';
import type {SpotifyArtistSearchQuery} from '../../types/graphql';
import {SpotifyArtistSearchDocument} from '../../types/graphql';
import apolloClient from '../../utils/apolloClient';
import {gql} from '@apollo/client';
import {useCombobox} from 'downshift';
import {useRef} from 'react';
import DropdownMenu from '../DropdownMenu';
import {FaXmark} from 'react-icons/fa6';
import {InputGroup} from '../chakra-snippets/input-group';
import {SpotifyCover} from './SpotifyCover';

gql`
  query SpotifyArtistSearch($query: String!, $limit: Int = 5) {
    spotifyArtist(query: $query, limit: $limit) {
      id
      name
      genre
      image
    }
  }
`;

type SpotifyArtist = {
  id: string;
  name: string;
  genre: string;
  image: string | null;
};

export default function SpotifyDropdown({
  initialValue,
}: {
  initialValue?: string;
}) {
  const {values, setFieldValue, setFieldError, setFieldTouched} =
    useFormikContext<{
      spotifyArtist?: SpotifyArtist;
      bandname?: string;
    }>();

  const {loading, data, setQuery} = useTypeahead<
    SpotifyArtistSearchQuery['spotifyArtist'][number]
  >({
    fetcher: async (query) => {
      const {data: d} = await apolloClient.query({
        query: SpotifyArtistSearchDocument,
        variables: {
          query,
        },
      });
      return d.spotifyArtist;
    },
    nullstateFetcher: initialValue
      ? async () => {
          const {data} = await apolloClient.query({
            query: SpotifyArtistSearchDocument,
            variables: {
              query: values.spotifyArtist?.name ?? initialValue,
            },
          });
          return data.spotifyArtist;
        }
      : undefined,
    minimumQueryLength: 1,
    keyExtractor: (item) => item.id,
    matchStringExtractor: (item) => item.name,
  });

  const ref = useRef<HTMLInputElement>(null);

  const {
    isOpen,
    highlightedIndex,
    getInputProps,
    getItemProps,
    getMenuProps,
    setInputValue,
    openMenu,
  } = useCombobox({
    defaultInputValue: values.spotifyArtist?.name,
    items: data,
    itemToString: (artist) => artist?.name ?? '',
    stateReducer: (_state, {type, changes}) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputClick:
          changes.isOpen = true;
          break;
      }
      return changes;
    },
    onInputValueChange: ({inputValue, type}) => {
      setQuery(inputValue ?? '');

      // Clear the selected artist when the user types or clears the input
      if (
        type === useCombobox.stateChangeTypes.InputChange ||
        type === useCombobox.stateChangeTypes.FunctionSetInputValue
      ) {
        if (!inputValue || inputValue !== values.spotifyArtist?.name) {
          setFieldValue('spotifyArtist', null);
          // Clear any existing error when the field is modified
          setFieldError('spotifyArtist', undefined);
          setFieldTouched('spotifyArtist', false);
        }
      }
    },
    onSelectedItemChange: ({selectedItem}) => {
      setFieldValue('spotifyArtist', selectedItem);
      ref.current?.blur();
    },
  });

  return (
    <>
      <InputGroup
        startOffset="-4px"
        w="100%"
        startElementProps={{ms: -2}}
        endElementProps={{me: -2}}
        startElement={
          <SpotifyCover image={values.spotifyArtist?.image} width="32px" />
        }
        endElement={
          values.spotifyArtist && (
            <IconButton
              onClick={() => setInputValue('')}
              size="xs"
              variant="ghost"
            >
              <FaXmark />
            </IconButton>
          )
        }
      >
        <FormikField
          as={Input}
          placeholder="Spotify-Profil suchen..."
          {...getInputProps({
            ref,
            onFocus: openMenu,
          })}
        />
      </InputGroup>
      <Box position="relative" w="full" mt="-4">
        <DropdownMenu
          getMenuProps={getMenuProps}
          getItemProps={getItemProps}
          isOpen={isOpen}
          loading={loading}
          data={data}
          highlightedIndex={highlightedIndex}
          itemRenderer={(artist) => (
            <HStack>
              <SpotifyCover image={artist.image} width="46px" />
              <VStack alignItems="flex-start" gap="0">
                <Text fontWeight="bold">{artist.name}</Text>
                <Text mt="-1" textTransform="capitalize">
                  {artist.genre}
                </Text>
              </VStack>
            </HStack>
          )}
          keyExtractor={(band) => band.id}
        />
      </Box>
    </>
  );
}
