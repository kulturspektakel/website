import {Textarea} from '@chakra-ui/react';
import useIsDJ from './useIsDJ';
import {HeardAboutBookingFrom, PreviouslyPlayed} from '../../types/graphql';
import {ConnectedField} from '../ConnectedField';
import {z} from 'zod';
import {useSearch} from '@tanstack/react-router';

export const schema = z.object({
  contactName: z.string().min(1),
  email: z.string().email(),
  contactPhone: z.string().min(1),
  knowsKultFrom: z.string(),
  hasPreviouslyPlayed: z.nativeEnum(PreviouslyPlayed),
  heardAboutBookingFrom: z.nativeEnum(HeardAboutBookingFrom),
});

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
