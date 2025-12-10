import {Text, Input} from '@chakra-ui/react';
import {Field as FormikField} from 'formik';
import useIsDJ from './useIsDJ';
import {useFormikContext} from 'formik';
import {InputGroup} from '../chakra-snippets/input-group';
import {ConnectedField} from '../ConnectedField';
import {z} from 'zod';
import normalizeUrl from 'normalize-url';
import {
  djSchema as step1DjSchema,
  bandSchema as step1BandSchema,
} from './Step1';
import SpotifyDropdown from './SpotifyDropdown';

const urlNormalizer = z.transform((url: string) => {
  if (!url) {
    return undefined;
  }
  try {
    return normalizeUrl(url.trim());
  } catch (e) {
    return url;
  }
});

const commonStep2 = z.object({
  spotifyArtist: z
    .object({
      id: z.string(),
      name: z.string(),
      genre: z.string().nullable(),
      image: z.string().nullable(),
    })
    .optional()
    .nullable(),
  instagram: z
    .string()
    .trim()
    .transform((val) => {
      const igUrl = val?.match(/instagram\.com\/([^\/?]+)/);
      if (igUrl?.[1]) {
        val = igUrl[1];
      }
      return val?.replace(/\s|@|\//g, '');
    })
    .optional(),
  facebook: z.string().trim().pipe(urlNormalizer).optional(),
  website: z.string().trim().pipe(urlNormalizer).optional(),
});

// DJ schema - demo is optional
const djStep2Schema = step1DjSchema.extend({
  ...commonStep2.shape,
  demo: z.string().pipe(urlNormalizer).optional(),
});

// Band schema - demo is required
const bandStep2Schema = step1BandSchema.extend({
  ...commonStep2.shape,
  demo: z.string().pipe(urlNormalizer),
});

export const djSchema = djStep2Schema;
export const bandSchema = bandStep2Schema;

export const schema = z.discriminatedUnion('genreCategory', [
  djSchema,
  bandSchema,
]);

export default function Step2() {
  const isDJ = useIsDJ();
  const {values} = useFormikContext<z.infer<typeof schema>>();

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
        autoFocus
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
      <ConnectedField
        name="spotifyArtist"
        label="Spotify"
        errorText="Spotify-Profil aus Liste auswählen"
      >
        <SpotifyDropdown initialValue={values.bandname} />
      </ConnectedField>
      <ConnectedField name="instagram" label="Instagram">
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
      </ConnectedField>
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
