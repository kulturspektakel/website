import {
  FormControl,
  FormHelperText,
  FormLabel,
  InputGroup,
  InputLeftElement,
  Text,
  Image,
  HStack,
  VStack,
  InputRightElement,
  CloseButton,
  FormErrorMessage,
  Center,
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
import {useRef, useState} from 'react';
import DropdownMenu from '../DropdownMenu';
import {FaSpotify} from 'react-icons/fa6';

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
  const {values, errors, setFieldValue} = useFormikContext<FormikContextT>();

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
    nullstateFetcher: values.bandname
      ? async () => {
          const {data} = await apolloClient.query({
            query: SpotifyArtistSearchDocument,
            variables: {
              query: values.bandname,
            },
          });
          return data.spotifyArtist;
        }
      : undefined,
    minimumQueryLength: 1,
    keyExtractor: (item) => item.id,
    matchStringExtractor: (item) => item.name,
  });

  const [spotifyInvalid, setSpotifyInvalid] = useState(false);

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
    items: data,
    itemToString: (artist) => artist?.name ?? '',
    stateReducer: (_state, {type, changes}) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputClick:
          changes.isOpen = true;
          break;
        case useCombobox.stateChangeTypes.FunctionSetInputValue:
        case useCombobox.stateChangeTypes.InputChange:
          setFieldValue('spotifyArtist', null);
          setSpotifyInvalid(changes.inputValue !== '');
          break;
      }
      return changes;
    },
    onInputValueChange: (e) => {
      setQuery(e.inputValue ?? '');
    },
    onSelectedItemChange: ({selectedItem}) => {
      setFieldValue('spotifyArtist', selectedItem);
      setSpotifyInvalid(false);
      ref.current?.blur();
    },
  });

  return (
    <>
      <FormControl id="demo" isRequired={!isDJ} isInvalid={!!errors.demo}>
        <FormLabel>Demomaterial</FormLabel>
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

      <FormControl id="spotifyArtist" isInvalid={spotifyInvalid}>
        <FormLabel>Spotify</FormLabel>
        <InputGroup>
          <InputLeftElement
            pointerEvents="none"
            children={
              <SpotifyCover image={values.spotifyArtist?.image} width="32px" />
            }
          />
          <Field
            pl="40px"
            placeholder="Spotify-Profil suchen..."
            {...getInputProps({ref, onFocus: openMenu})}
          />
          <InputRightElement>
            <CloseButton onClick={() => setInputValue('')} />
          </InputRightElement>
        </InputGroup>

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
              <VStack alignItems="flex-start" spacing="0">
                <Text fontWeight="bold">{artist.name}</Text>
                <Text mt="-1">{artist.genre}</Text>
              </VStack>
            </HStack>
          )}
          keyExtractor={(band) => band.id}
        />
        <FormErrorMessage>Spotify-Profil aus Liste auswählen</FormErrorMessage>
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

function SpotifyCover({image, width}: {image?: string | null; width: string}) {
  return (
    <Image
      src={image ?? undefined}
      fallback={
        <Center aspectRatio={1} w={width} borderRadius="md" bg="offwhite.200">
          <FaSpotify color="white" />
        </Center>
      }
      w={width}
      aspectRatio={1}
      objectFit="cover"
      borderRadius="md"
    />
  );
}
