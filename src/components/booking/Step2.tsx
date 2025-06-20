import {
  Text,
  Image,
  HStack,
  VStack,
  IconButton,
  Center,
  Input,
  BoxProps,
  Box,
} from '@chakra-ui/react';
import {Field as FormikField} from 'formik';
import useIsDJ from './useIsDJ';
import {useFormikContext} from 'formik';
import {useTypeahead} from 'tomo-typeahead/react';
import type {SpotifyArtistSearchQuery} from '../../types/graphql';
import {SpotifyArtistSearchDocument} from '../../types/graphql';
import apolloClient from '../../utils/apolloClient';
import {gql} from '@apollo/client';
import {useCombobox} from 'downshift';
import {useRef, useState} from 'react';
import DropdownMenu from '../DropdownMenu';
import {FaSpotify} from 'react-icons/fa6';
import {FaXmark} from 'react-icons/fa6';
import {InputGroup} from '../chakra-snippets/input-group';
import {Field} from '../chakra-snippets/field';
import {ConnectedField} from '../ConnectedField';
import {z} from 'zod';
import {FormikContextT} from '../../routes/booking_.$applicationType';

export const schema = z.object({
  demo: z.string().min(1),
  spotifyArtist: z
    .object({
      id: z.string(),
      name: z.string(),
      genre: z.string(),
      image: z.string().nullable(),
    })
    .nullable(),
  instagram: z.string(),
  facebook: z.string(),
  website: z.string(),
});

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
  const {values, setFieldValue} = useFormikContext<FormikContextT>();

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
      <ConnectedField
        label="Demomaterial"
        helperText={
          isDJ
            ? 'Bitte gib uns einen direkten Link zu ein paar Mixes/Beispielen von dir.'
            : 'Am liebsten YouTube, Spotify, Soundcloud oder Bandcamp. Gerne auch Live-Mitschnitte.'
        }
        name="demo"
        required={!isDJ}
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
      <Field
        id="spotifyArtist"
        label="Spotify"
        invalid={!isOpen && spotifyInvalid}
        errorText="Spotify-Profil aus Liste auswählen"
      >
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
      </Field>
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
      <Field label="Instagram">
        <InputGroup
          w="100%"
          startElement={
            <Text mt="-0.5" color="gray.400">
              @
            </Text>
          }
        >
          <FormikField
            as={Input}
            name="instagram"
            placeholder="kulturspektakel"
            paddingStart="7"
          />
        </InputGroup>
      </Field>
      <ConnectedField
        label="Facebook"
        name="facebook"
        placeholder="https://facebook.com/kulturspektakel"
      />
      <ConnectedField
        label="Webseite"
        name="website"
        placeholder="https://kulturspektakel.de"
      />
    </>
  );
}

function SpotifyCover({
  image,
  ...props
}: {image?: string | null; width: string} & BoxProps) {
  if (!image) {
    return (
      <Center aspectRatio={1} borderRadius="md" bg="offwhite.200" {...props}>
        <FaSpotify color="white" />
      </Center>
    );
  }
  return (
    <Image
      src={image ?? undefined}
      aspectRatio={1}
      objectFit="cover"
      borderRadius="md"
      {...props}
    />
  );
}
