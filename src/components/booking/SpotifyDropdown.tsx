import {Text, HStack, VStack, IconButton, Input, Box} from '@chakra-ui/react';
import {Field as FormikField} from 'formik';
import {useFormikContext} from 'formik';
import {useCombobox} from 'downshift';
import {useRef} from 'react';
import DropdownMenu from '../DropdownMenu';
import {FaXmark} from 'react-icons/fa6';
import {InputGroup} from '../chakra-snippets/input-group';
import {SpotifyCover} from './SpotifyCover';
import {createServerFn, useServerFn} from '@tanstack/react-start';
import {useTypeahead} from 'tomo-typeahead/react';

type SpotifyArtist = {
  id: string;
  name: string;
  genre: string | null;
  image: string | null;
};

let TOKEN: {
  access_token: string;
  token_type: string;
  expires_in: number;
} | null = null;

async function getSpotifyToken() {
  if (TOKEN && TOKEN.expires_in > Date.now() / 1000) {
    return TOKEN;
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  TOKEN = await res.json();
  return TOKEN;
}

const getSpotifyArtists = createServerFn()
  .inputValidator((data: string) => data)
  .handler(async ({data: query}) => {
    const token = await getSpotifyToken();
    if (!token) {
      throw new Error('Could not get Spotify token');
    }
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query,
      )}&type=artist&market=DE&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      },
    );

    if (res.status === 429) {
      throw new Error('Spotify API limit reached');
    } else if (res.status === 401) {
      throw new Error('Spotify API token expired');
    } else if (res.status !== 200) {
      throw new Error(`Spotify API returned ${res.status}`);
    }

    const json: {
      artists: {
        href: string;
        items: Array<{
          external_urls: {
            spotify: string;
          };
          genres: string[];
          href: string;
          id: string;
          images: Array<{
            height: number;
            url: string;
            width: number;
          }>;
          name: string;
          popularity: number;
          type: string;
          uri: string;
        }>;
        limit: number;
        next: string;
        offset: number;
        previous: null;
        total: number;
      };
    } = await res.json();

    return json.artists.items.map((artist) => ({
      name: artist.name,
      id: artist.id,
      image: artist.images.at(artist.images.length - 1)?.url ?? null,
      genre: artist.genres.at(0) ?? null,
    })) satisfies SpotifyArtist[];
  });

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

  const querySpotifyArtists = useServerFn(getSpotifyArtists);

  const {loading, data, setQuery} = useTypeahead<SpotifyArtist>({
    fetcher: (query) => querySpotifyArtists({data: query}),
    nullstateFetcher: initialValue
      ? () =>
          querySpotifyArtists({
            data: values.spotifyArtist?.name ?? initialValue,
          })
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
