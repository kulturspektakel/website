import {
  FormControl,
  FormHelperText,
  FormLabel,
  Textarea,
  Select,
} from '@chakra-ui/react';
import Field from '../components/booking/Field';
import {HeardAboutBookingFrom, PreviouslyPlayed} from '../types/graphql';
import useIsDJ from '../components/booking/useIsDJ';
import {getUtmSource} from '~/routes/booking.bewerbung.$applicationType.test';

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

  return (
    <>
      <FormControl id="contactName" isRequired>
        <FormLabel>
          {isDJ ? `Vollständiger Name` : `Ansprechpartner*in`}
        </FormLabel>
        <Field />
      </FormControl>

      <FormControl id="email" isRequired>
        <FormLabel>Email-Adresse</FormLabel>
        <Field type="email" />
      </FormControl>

      <FormControl id="contactPhone" isRequired>
        <FormLabel>Handynummer</FormLabel>
        <Field type="tel" />
      </FormControl>

      <FormControl id="knowsKultFrom">
        <FormLabel>
          {isDJ ? 'Woher kennst du das Kult?' : `Woher kennt ihr das Kult?`}
        </FormLabel>
        <FormHelperText mt="-2" mb="2">
          {isDJ
            ? 'Was verbindet dich mit unserer Veranstaltung? Woher kennst du das Kulturspektakel? Was wolltest du uns schon immer mal erzählen?'
            : `Was verbindet euch mit unserer Veranstaltung? Wart ihr schonmal
              da? Woher kennt ihr das Kulturspektakel? Was wolltet ihr uns schon
              immer mal erzählen?`}
        </FormHelperText>
        <Field as={Textarea} />
      </FormControl>

      <FormControl id="hasPreviouslyPlayed">
        <FormLabel>
          {isDJ
            ? 'Hast du schonmal bei uns aufgelegt?'
            : `Habt ihr schonmal bei uns gespielt?`}
        </FormLabel>
        <Field as={Select} placeholder="bitte auswählen…">
          {Array.from(PLAYED_PREVIOUSLY.entries())
            .filter(
              ([v]) => !isDJ || (isDJ && v !== PreviouslyPlayed.OtherFormation),
            )
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Field>
      </FormControl>

      {!getUtmSource() && (
        <FormControl id="heardAboutBookingFrom">
          <FormLabel>
            {isDJ
              ? `Wie bist du auf unser Booking aufmerksam geworden?`
              : `Wie seid ihr auf unser Booking aufmerksam geworden?`}
          </FormLabel>
          <Field as={Select} placeholder="bitte auswählen…">
            {Array.from(HEARD_ABOUT.entries()).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Field>
        </FormControl>
      )}
    </>
  );
}
