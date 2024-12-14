import {
  HStack,
  Textarea,
  Text,
  Link as ChakraLink,
  Box,
  Input,
  Icon,
} from '@chakra-ui/react';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../chakra-snippets/native-select';
import {Link} from '@remix-run/react';
import DistanceWarning from './DistanceWarning';
import DuplicateApplicationWarning from './DuplicateApplicationWarning';
import useIsDJ from './useIsDJ';
import {BandRepertoireType, GenreCategory} from '~/types/graphql';
import type {FormikContextT} from '~/routes/booking.$applicationType._index';
import {useFormikContext} from 'formik';
import {Field as FormikField} from 'formik';
import {Field} from '../chakra-snippets/field';
import {Alert} from '../chakra-snippets/alert';

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

const REPERTOIRE: Map<BandRepertoireType, string> = new Map([
  [BandRepertoireType.ExclusivelyOwnSongs, 'ausschließlich eigene Songs'],
  [BandRepertoireType.MostlyOwnSongs, 'hauptächlich eigene Songs'],
  [BandRepertoireType.MostlyCoverSongs, 'haupstsächlich Cover-Songs'],
  [BandRepertoireType.ExclusivelyCoverSongs, 'ausschließlich Cover-Songs'],
]);

export default function Step1() {
  const isDJ = useIsDJ();
  const {values} = useFormikContext<FormikContextT>();

  return (
    <>
      <Field required label={isDJ ? 'Künstler:innen-Name' : 'Bandname'}>
        <FormikField name="bandname" as={Input} />
      </Field>
      <DuplicateApplicationWarning bandname={values.bandname} />

      <HStack w="100%" alignItems="flex-end">
        <Field
          id={isDJ ? 'genre' : 'genreCategory'}
          required={!isDJ}
          label="Musikrichtung"
        >
          {isDJ ? (
            <FormikField name="genre" as={Input} />
          ) : (
            <NativeSelectRoot>
              <FormikField
                name="genreCategory"
                as={NativeSelectField}
                placeholder="bitte auswählen…"
              >
                {Array.from(GENRE_CATEGORIES.entries()).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </FormikField>
            </NativeSelectRoot>
          )}
        </Field>
        {!isDJ && (
          <Field>
            <FormikField
              name="genre"
              as={Input}
              placeholder="genaues Genre (optional)"
            />
          </Field>
        )}
      </HStack>
      {!isDJ && (
        <>
          <Field label="Ihr spielt&hellip;" required>
            <NativeSelectRoot>
              <FormikField
                name="repertoire"
                as={NativeSelectField}
                placeholder="bitte auswählen…"
              >
                {Array.from(REPERTOIRE.entries()).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </FormikField>
            </NativeSelectRoot>
          </Field>
          {(values.repertoire === BandRepertoireType.MostlyCoverSongs ||
            values.repertoire === BandRepertoireType.ExclusivelyCoverSongs) && (
            <Alert
              status="warning"
              borderRadius="md"
              alignItems="flex-start"
              title="Coverbands"
              variant="surface"
            >
              Wir möchten bevorzugt Bands mit eigenen Songs eine Bühne bieten.
              Reine Tribute-/Coverbands ohne eigene Interpretationen buchen wir
              nicht.
            </Alert>
          )}
        </>
      )}

      <Field
        label={isDJ ? 'Beschreibung' : 'Bandbeschreibung'}
        required
        helperText="Maximal 2.000 Zeichen, wir müssen das alles lesen!"
      >
        <Text mt="1" fontSize="sm" color="offwhite.600">
          {isDJ
            ? 'Erzähl uns was über dich! Was legst du auf? Wie lange machst du das schon?'
            : `Erzählt uns etwas über eure Band! Was macht ihr für Musik? Was
              ist eure Bandgeschichte?`}
        </Text>
        <FormikField as={Textarea} name="description" maxLength={2000} />
      </Field>

      <Field label="Anreise aus&hellip;" required>
        <FormikField as={Input} name="city" placeholder="Ort" />
      </Field>

      <DistanceWarning origin={values.city} />

      {!isDJ && (
        <>
          <HStack w="100%">
            <Field label="Anzahl Bandmitglieder" required>
              <FormikField
                name="numberOfArtists"
                as={Input}
                type="number"
                min={1}
              />
            </Field>
            <Field
              label={
                <>
                  davon <strong>nicht</strong> männlich
                </>
              }
              required
            >
              <FormikField
                name="numberOfNonMaleArtists"
                as={Input}
                type="number"
                min={0}
                max={values.numberOfArtists ?? 100}
                validate={(v) => {
                  if (values.numberOfArtists && v > values.numberOfArtists) {
                    return 'wrong number';
                  }
                }}
              />
            </Field>
          </HStack>
          {values.numberOfArtists != null &&
            values.numberOfNonMaleArtists != null &&
            values.numberOfNonMaleArtists === values.numberOfArtists && (
              <Box fontWeight="bold" textAlign="center">
                🌈 Yay, für mehr Diversität auf Festivalbühnen!
              </Box>
            )}
          <Text fontSize="sm" color="offwhite.600">
            Die Festival-Branche hat eine geringe Geschlechter&shy;diversität (
            <ChakraLink asChild textDecoration="underline">
              <Link
                to="https://bit.ly/2HxZMgl"
                rel="noreferrer"
                target="_blank"
              >
                mehr Informationen
              </Link>
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
