import {
  FormControl,
  FormLabel,
  HStack,
  Select,
  FormHelperText,
  Textarea,
  Text,
  Link as ChakraLink,
} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import DistanceWarning from './DistanceWarning';
import DuplicateApplicationWarning from './DuplicateApplicationWarning';
import Field from './Field';
import useIsDJ from './useIsDJ';
import {GenreCategory} from '~/types/graphql';
import type {FormikContextT} from '~/routes/booking.$applicationType._index';
import {useFormikContext} from 'formik';

const GENRE_CATEGORIES: Map<GenreCategory, string> = new Map([
  [GenreCategory.Pop, 'Pop'],
  [GenreCategory.Rock, 'Rock'],
  [GenreCategory.Indie, 'Indie'],
  [GenreCategory.HardrockMetalPunk, 'Hardrock / Metal / Punk'],
  [
    GenreCategory.FolkSingerSongwriterCountry,
    'Folk / Singer/Songwriter / Country',
  ],
  [GenreCategory.ElektroHipHop, 'Elektro / Hip-Hop'],
  [GenreCategory.BluesFunkJazzSoul, 'Blues / Funk / Jazz / Soul'],
  [GenreCategory.ReggaeSka, 'Reggae / Ska'],
  [GenreCategory.Other, 'andere Musikrichtung'],
]);

export default function Step1() {
  const isDJ = useIsDJ();
  const {values, errors} = useFormikContext<FormikContextT>();

  return (
    <>
      <FormControl id="bandname" isRequired>
        <FormLabel>{isDJ ? 'Künstler:innen-Name' : 'Bandname'}</FormLabel>
        <Field />
      </FormControl>
      <DuplicateApplicationWarning bandname={values.bandname} />

      <HStack w="100%">
        <FormControl
          id={isDJ ? 'genre' : 'genreCategory'}
          isRequired={!isDJ}
          isInvalid={!!errors.numberOfNonMaleArtists}
        >
          <FormLabel>Musikrichtung</FormLabel>
          {isDJ ? (
            <Field />
          ) : (
            <Field as={Select} placeholder="bitte auswählen…">
              {Array.from(GENRE_CATEGORIES.entries()).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </Field>
          )}
        </FormControl>
        {!isDJ && (
          <FormControl id="genre">
            <Field placeholder="genaues Genre (optional)" mt="8" />
          </FormControl>
        )}
      </HStack>

      <FormControl isRequired id="description">
        <FormLabel>{isDJ ? 'Beschreibung' : 'Bandbeschreibung'}</FormLabel>
        <FormHelperText mt="-2" mb="2">
          {isDJ
            ? 'Erzähl uns was über dich! Was legst du auf? Wie lange machst du das schon?'
            : `Erzählt uns etwas über eure Band! Was macht ihr für Musik? Was
                  ist eure Bandgeschichte?`}
        </FormHelperText>
        <Field as={Textarea} />
      </FormControl>

      <FormControl id="city" isRequired>
        <FormLabel>Wohnort</FormLabel>
        <Field />
      </FormControl>

      <DistanceWarning origin={values.city} />

      {!isDJ && (
        <>
          <HStack w="100%">
            <FormControl id="numberOfArtists" isRequired>
              <FormLabel>Anzahl Bandmitglieder</FormLabel>
              <Field type="number" min={1} />
            </FormControl>
            <FormControl id="numberOfNonMaleArtists" isRequired>
              <FormLabel>
                davon <strong>nicht</strong> männlich
              </FormLabel>
              <Field
                type="number"
                min={0}
                max={values.numberOfArtists ?? 100}
                validate={(v) => {
                  if (values.numberOfArtists && v > values.numberOfArtists) {
                    return 'wrong number';
                  }
                }}
              />
            </FormControl>
          </HStack>
          <Text fontSize="sm" color="gray.500">
            Die Festival-Branche hat eine geringe Geschlechter&shy;diversität (
            <ChakraLink
              as={Link}
              textDecoration="underline"
              rel="noreferrer"
              to="https://bit.ly/2HxZMgl"
              target="_blank"
              isExternal
            >
              mehr Informationen
            </ChakraLink>
            ). Wir wählen die Bands nicht nach Geschlechter&shy;verteilung aus,
            trotzdem wollen wir einen besseren Überblick über die Situation
            bekommen. Personen und Gruppen die auf Festival&shy;bühnen
            unter&shy;repräsentiert sind möchten wir explizit ermutigen sich bei
            uns zu bewerben.
          </Text>
        </>
      )}
    </>
  );
}