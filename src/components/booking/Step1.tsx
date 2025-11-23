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
import {useFormikContext} from 'formik';
import {Alert} from '../chakra-snippets/alert';
import {ConnectedField} from '../ConnectedField';
import {z} from 'zod';
import {BandRepertoire, GenreCategory} from '@prisma/client';

const baseSchema = z.object({
  bandname: z.string().trim().min(1),
  genre: z.string().optional(),
  description: z.string().min(1),
  city: z.string().trim().min(1),
});

const djBaseSchema = baseSchema.extend({
  genreCategory: z.literal(GenreCategory.DJ),
});

const bandBaseSchema = baseSchema.extend({
  genreCategory: z.enum(
    Object.values(GenreCategory).filter((v) => v !== GenreCategory.DJ),
  ),
  numberOfArtists: z.number(),
  numberOfNonMaleArtists: z.number(),
  repertoire: z.enum(Object.values(BandRepertoire)),
});

export const djSchema = djBaseSchema;
export const bandSchema = bandBaseSchema;

export const schema = z.discriminatedUnion('genreCategory', [
  djSchema,
  bandSchema,
]);

const GENRE_CATEGORIES: Map<GenreCategory, string> = new Map([
  [GenreCategory.Pop, 'Pop'],
  [GenreCategory.Rock, 'Rock'],
  [GenreCategory.Indie, 'Indie'],
  [GenreCategory.Hardrock_Metal_Punk, 'Hardrock / Metal / Punk'],
  [
    GenreCategory.Folk_SingerSongwriter_Country,
    'Folk / Singer/Songwriter / Country',
  ],
  [GenreCategory.Elektro_HipHop, 'Elektro / Hip-Hop'],
  [GenreCategory.Blues_Funk_Jazz_Soul, 'Blues / Funk / Jazz / Soul'],
  [GenreCategory.Reggae_Ska, 'Reggae / Ska'],
  [GenreCategory.Other, 'andere Musikrichtung'],
]);

const REPERTOIRE: Map<BandRepertoire, string> = new Map([
  [BandRepertoire.ExclusivelyOwnSongs, 'ausschließlich eigene Songs'],
  [BandRepertoire.MostlyOwnSongs, 'hauptächlich eigene Songs'],
  [BandRepertoire.MostlyCoverSongs, 'haupstsächlich Cover-Songs'],
  [BandRepertoire.ExclusivelyCoverSongs, 'ausschließlich Cover-Songs'],
]);

export default function Step1() {
  const isDJ = useIsDJ();
  const {values} = useFormikContext<z.infer<typeof schema>>();

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
        {values.genreCategory !== 'DJ' && (
          <ConnectedField name="genre" placeholder="genaues Genre (optional)" />
        )}
      </HStack>
      {values.genreCategory !== 'DJ' && (
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
          {(values.repertoire === BandRepertoire.MostlyCoverSongs ||
            values.repertoire === BandRepertoire.ExclusivelyCoverSongs) && (
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

      {values.genreCategory !== 'DJ' && (
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
