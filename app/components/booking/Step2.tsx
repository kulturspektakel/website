import {
  FormControl,
  FormHelperText,
  FormLabel,
  InputGroup,
  InputLeftElement,
  Text,
  Image,
  AspectRatio,
  HStack,
  VStack,
  Heading,
} from '@chakra-ui/react';
import Field from './Field';
import useIsDJ from './useIsDJ';
import {useFormikContext} from 'formik';
import type {FormikContextT} from '~/routes/booking.$applicationType._index';
import {useTypeahead} from 'tomo-typeahead/react';
import type {SpotifyArtistSearchQuery} from '~/types/graphql';
import {SpotifyArtistSearchDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {gql} from '@apollo/client';
import {useCombobox} from 'downshift';
import {useEffect, useRef} from 'react';
import DropdownMenu from '../DropdownMenu';

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

export default function Step2() {
  const isDJ = useIsDJ();
  const {values, errors} = useFormikContext<FormikContextT>();
  values.bandname = 'Stray Colors';

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
    minimumQueryLength: 0,
    keyExtractor: (item) => item.id,
    matchStringExtractor: (item) => item.name,
  });

  useEffect(() => {
    setQuery(values.bandname ?? '');
  }, [values.bandname]);

  // const ref = useRef<HTMLInputElement>(null);

  const {isOpen, highlightedIndex, getInputProps, getItemProps, getMenuProps} =
    useCombobox({
      items: data,
      itemToString: (artist) => artist?.name ?? '',
      // stateReducer: (_state, {type, changes}) => {},
      onInputValueChange: (e) => setQuery(e.inputValue ?? ''),
      onSelectedItemChange: ({selectedItem}) => {},
    });

  return (
    <>
      <FormControl id="demo" isRequired={!isDJ} isInvalid={!!errors.demo}>
        <FormLabel>Demomaterial: YouTube, Spotify, etc.</FormLabel>
        <FormHelperText mt="-2" mb="2">
          {isDJ
            ? 'Bitte gib uns einen direkten Link zu ein paar Mixes/Beispielen von dir.'
            : 'Am liebsten YouTube, Spotify, Soundcloud oder Bandcamp. Gerne auch Live-Mitschnitte.'}
        </FormHelperText>
        <Field
          type="text"
          placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          validate={(url) => {
            if (
              url &&
              !/^(https?:\/\/)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?$/.test(
                url,
              )
            ) {
              return 'ungültige URL';
            }
          }}
        />
      </FormControl>

      <FormControl id="spotifyArtist">
        <FormLabel>Spotify</FormLabel>
        <Field placeholder="" {...getInputProps()} />
        <DropdownMenu
          getMenuProps={getMenuProps}
          getItemProps={getItemProps}
          isOpen={isOpen}
          loading={loading}
          data={data}
          highlightedIndex={highlightedIndex}
          itemRenderer={(artist) => (
            <HStack>
              <AspectRatio
                ratio={1}
                borderRadius="lg"
                w="46px"
                bgColor="offwhite.300"
                overflow="hidden"
              >
                <Image src={artist.image ?? ''} />
              </AspectRatio>
              <VStack alignItems="flex-start" spacing="0">
                <Text fontWeight="bold">{artist.name}</Text>
                <Text mt="-1">{artist.genre}</Text>
              </VStack>
            </HStack>
          )}
          keyExtractor={(band) => band.id}
        />
      </FormControl>

      <FormControl id="instagram">
        <FormLabel>Instagram</FormLabel>
        <InputGroup>
          <InputLeftElement pointerEvents="none" color="gray.400">
            @
          </InputLeftElement>
          <Field placeholder="kulturspektakel" paddingStart="7" />
        </InputGroup>
      </FormControl>

      <FormControl id="facebook">
        <FormLabel>Facebook</FormLabel>
        <Field type="text" placeholder="https://facebook.com/kulturspektakel" />
      </FormControl>

      <FormControl id="website">
        <FormLabel>Webseite</FormLabel>
        <Field type="text" placeholder="https://kulturspektakel.de" />
      </FormControl>
    </>
  );
}
