import {
  Text,
  Image,
  HStack,
  VStack,
  IconButton,
  Center,
  Input,
} from '@chakra-ui/react';
import {Field} from '../Field';
import {Field as FormikField} from 'formik';
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
import {CloseIcon} from '@chakra-ui/icons';
import {InputGroup} from '../InputGroup';

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
              query: values.spotifyArtist?.name ?? values.bandname,
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
    defaultInputValue: values.spotifyArtist?.name,
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
      <Field
        label="Demomaterial"
        helperText={
          isDJ
            ? 'Bitte gib uns einen direkten Link zu ein paar Mixes/Beispielen von dir.'
            : 'Am liebsten YouTube, Spotify, Soundcloud oder Bandcamp. Gerne auch Live-Mitschnitte.'
        }
      >
        <FormikField
          as={Input}
          id="demo"
          required={!isDJ}
          invalid={!!errors.demo}
          validate={(url: string) => {
            if (
              url &&
              !/^(https?:\/\/)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?$/.test(
                url,
              )
            ) {
              return 'ungültige URL';
            }
          }}
          placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        />
      </Field>

      <Field
        id="spotifyArtist"
        label="Spotify"
        invalid={spotifyInvalid}
        errorText="Spotify-Profil aus Liste auswählen"
      >
        <InputGroup
          startElement={
            <SpotifyCover image={values.spotifyArtist?.image} width="32px" />
          }
          endElement={
            <IconButton onClick={() => setInputValue('')}>
              <CloseIcon />
            </IconButton>
          }
        >
          <FormikField
            as={Input}
            pl="40px"
            placeholder="Spotify-Profil suchen..."
            {...getInputProps({
              ref,
              onFocus: openMenu,
            })}
          />
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
      </Field>

      <Field label="Instagram">
        <InputGroup startElement={<Text color="gray.400">@</Text>}>
          <FormikField
            as={Input}
            id="instagram"
            placeholder="kulturspektakel"
            paddingStart="7"
          />
        </InputGroup>
      </Field>

      <Field label="Facebook">
        <FormikField
          as={Input}
          id="facebook"
          placeholder="https://facebook.com/kulturspektakel"
        />
      </Field>

      <Field label="Webseite">
        <FormikField
          as={Input}
          id="website"
          placeholder="https://kulturspektakel.de"
        />
      </Field>
    </>
  );
}

function SpotifyCover({image, width}: {image?: string | null; width: string}) {
  if (!image) {
    return (
      <Center aspectRatio={1} w={width} borderRadius="md" bg="offwhite.200">
        <FaSpotify color="white" />
      </Center>
    );
  }
  return (
    <Image
      src={image ?? undefined}
      w={width}
      aspectRatio={1}
      objectFit="cover"
      borderRadius="md"
    />
  );
}
