import {
  HStack,
  Textarea,
  Text,
  Link as ChakraLink,
  Box,
} from '@chakra-ui/react';
import DistanceWarning from './DistanceWarning';
import DuplicateApplicationWarning from './DuplicateApplicationWarning';
import useIsDJ from './useIsDJ';
import {BandRepertoireType, GenreCategory} from '../../types/graphql';
import {useFormikContext} from 'formik';
import {Alert} from '../chakra-snippets/alert';
import {ConnectedField} from '../ConnectedField';
import {z} from 'zod';
import {FormikContextT} from '../../routes/booking_.$applicationType';

export const schema = z.object({
  bandname: z.string().min(1),
  genreCategory: z.nativeEnum(GenreCategory),
  genre: z.string(),
  description: z.string().min(1),
  city: z.string().min(1),

  // Bands only
  numberOfArtists: z.number(),
  numberOfNonMaleArtists: z.number(),
  repertoire: z.nativeEnum(BandRepertoireType),
});

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
      <ConnectedField
        label={isDJ ? 'Künstler:innen-Name' : 'Bandname'}
        name="bandname"
        required
      />

      <DuplicateApplicationWarning bandname={values.bandname} />

      <HStack w="100%" alignItems="flex-end">
        <ConnectedField
          name={isDJ ? 'genre' : 'genreCategory'}
          required={!isDJ}
          label="Musikrichtung"
          options={
            isDJ
              ? undefined
              : Array.from(GENRE_CATEGORIES.entries()).map(
                  ([value, label]) => ({
                    value,
                    label,
                  }),
                )
          }
        />
        {!isDJ && (
          <ConnectedField name="genre" placeholder="genaues Genre (optional)" />
        )}
      </HStack>
      {!isDJ && (
        <>
          <ConnectedField
            name="repertoire"
            label="Ihr spielt&hellip;"
            required
            options={Array.from(REPERTOIRE.entries()).map(([value, label]) => ({
              value,
              label,
            }))}
          />
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

      <ConnectedField
        label={isDJ ? 'Beschreibung' : 'Bandbeschreibung'}
        required
        helperText="Maximal 2.000 Zeichen, wir müssen das alles lesen!"
        name="description"
        maxLength={2000}
        as={Textarea}
        description={
          isDJ
            ? 'Erzähl uns was über dich! Was legst du auf? Wie lange machst du das schon?'
            : `Erzählt uns etwas über eure Band! Was macht ihr für Musik? Was
            ist eure Bandgeschichte?`
        }
      />

      <ConnectedField
        name="city"
        placeholder="Ort"
        label="Anreise aus&hellip;"
        required
      />

      <DistanceWarning origin={values.city} />

      {!isDJ && (
        <>
          <HStack w="100%" align="top">
            <ConnectedField
              label="Anzahl Bandmitglieder"
              required
              name="numberOfArtists"
              type="number"
              min={1}
            />
            <ConnectedField
              label={
                <>
                  davon <strong>nicht</strong> männlich
                </>
              }
              required
              name="numberOfNonMaleArtists"
              type="number"
              min={0}
              max={values.numberOfArtists ?? 100}
              validate={(v: number) => {
                if (values.numberOfArtists && v > values.numberOfArtists) {
                  return 'Anzahl zu hoch';
                }
              }}
            />
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
            <ChakraLink href="https://bit.ly/2HxZMgl" target="_blank">
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
