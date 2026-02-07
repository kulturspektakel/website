import {Textarea} from '@chakra-ui/react';
import useIsDJ from './useIsDJ';
import {ConnectedField} from '../ConnectedField';
import {z} from 'zod';
import {useSearch} from '@tanstack/react-router';
import {HeardAboutBookingFrom, PreviouslyPlayed} from '@prisma/client';

import {
  djSchema as step2DjSchema,
  bandSchema as step2BandSchema,
} from './Step2';

const commonStep3 = z.object({
  contactName: z.string().min(1, 'Bitte Name eingeben'),
  email: z.email('Bitte gültige E-Mail-Adresse eingeben'),
  contactPhone: z.string().min(1, 'Bitte Handynummer eingeben'),
  knowsKultFrom: z.string().optional(),
  hasPreviouslyPlayed: z
    .enum(Object.values(PreviouslyPlayed))
    .optional()
    .catch(undefined),
  heardAboutBookingFrom: z
    .enum(Object.values(HeardAboutBookingFrom))
    .optional()
    .catch(undefined),
});

const djSchema = step2DjSchema.extend(commonStep3.shape);
const bandSchema = step2BandSchema.extend(commonStep3.shape);

export const schema = z.discriminatedUnion('genreCategory', [
  djSchema,
  bandSchema,
]);

const HEARD_ABOUT: Map<HeardAboutBookingFrom, string> = new Map([
  [HeardAboutBookingFrom.BYon, 'BY-on'],
  [HeardAboutBookingFrom.Facebook, 'Facebook'],
  [HeardAboutBookingFrom.Instagram, 'Instagram'],
  [HeardAboutBookingFrom.Friends, 'Freunde / Bekannte'],
  [HeardAboutBookingFrom.Newspaper, 'Zeitung'],
  [HeardAboutBookingFrom.Website, 'Webseite'],
]);

const PLAYED_PREVIOUSLY: Map<PreviouslyPlayed, string> = new Map([
  [PreviouslyPlayed.Yes, 'Ja'],
  [PreviouslyPlayed.OtherFormation, 'Mit einer anderen Band'],
  [PreviouslyPlayed.No, 'Nein'],
]);

export default function Step3() {
  const isDJ = useIsDJ();
  const search = useSearch({
    from: '/booking_/$applicationType',
  });

  return (
    <>
      <ConnectedField
        label={isDJ ? `Vollständiger Name` : `Ansprechpartner*in`}
        required
        name="contactName"
        autoFocus
      />

      <ConnectedField
        required
        label="Email-Adresse"
        name="email"
        type="email"
      />

      <ConnectedField
        required
        label="Handynummer"
        name="contactPhone"
        type="tel"
      />

      <ConnectedField
        label={isDJ ? 'Woher kennst du das Kult?' : `Woher kennt ihr das Kult?`}
        as={Textarea}
        name="knowsKultFrom"
        helperText={
          isDJ
            ? 'Was verbindet dich mit unserer Veranstaltung? Woher kennst du das Kulturspektakel? Was wolltest du uns schon immer mal erzählen?'
            : `Wart ihr schonmal da? Woher kennt ihr das Kulturspektakel? Was verbindet euch mit unserer Veranstaltung? Was wolltet ihr uns schon immer mal erzählen? `
        }
      />

      <ConnectedField
        label={
          isDJ
            ? 'Hast du schonmal bei uns aufgelegt?'
            : `Habt ihr schonmal bei uns gespielt?`
        }
        name="hasPreviouslyPlayed"
        options={Array.from(PLAYED_PREVIOUSLY.entries())
          .filter(
            ([v]) => !isDJ || (isDJ && v !== PreviouslyPlayed.OtherFormation),
          )
          .map(([value, label]) => ({value, label}))}
      />

      {!search?.utm_source && (
        <ConnectedField
          label={
            isDJ
              ? `Wie bist du auf unser Booking aufmerksam geworden?`
              : `Wie seid ihr auf unser Booking aufmerksam geworden?`
          }
          name="heardAboutBookingFrom"
          options={Array.from(HEARD_ABOUT.entries()).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      )}
    </>
  );
}
