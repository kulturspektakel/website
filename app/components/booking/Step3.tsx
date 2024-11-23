import {Textarea, Select, Input} from '@chakra-ui/react';
import {Field as FormikField} from 'formik';
import useIsDJ from './useIsDJ';
import {HeardAboutBookingFrom, PreviouslyPlayed} from '~/types/graphql';
import {useUtmSource} from '~/routes/booking._index';
import {Field} from '../chakra-snippets/field';

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
  const utmSource = useUtmSource();

  return (
    <>
      <Field
        label={isDJ ? `Vollständiger Name` : `Ansprechpartner*in`}
        required
      >
        <FormikField as={Input} id="contactName" />
      </Field>

      <Field label="Email-Adresse">
        <FormikField as={Input} id="email" type="email" />
      </Field>

      <Field label="Handynummer">
        <FormikField as={Input} id="contactPhone" type="tel" />
      </Field>

      <Field
        label={isDJ ? 'Woher kennst du das Kult?' : `Woher kennt ihr das Kult?`}
        helperText={
          isDJ
            ? 'Was verbindet dich mit unserer Veranstaltung? Woher kennst du das Kulturspektakel? Was wolltest du uns schon immer mal erzählen?'
            : `Wart ihr schonmal da? Woher kennt ihr das Kulturspektakel? Was verbindet euch mit unserer Veranstaltung? Was wolltet ihr uns schon immer mal erzählen? `
        }
      >
        <FormikField as={Textarea} id="knowsKultFrom" />
      </Field>

      <Field
        label={
          isDJ
            ? 'Hast du schonmal bei uns aufgelegt?'
            : `Habt ihr schonmal bei uns gespielt?`
        }
      >
        <FormikField
          id="hasPreviouslyPlayed"
          as={Select}
          placeholder="bitte auswählen…"
        >
          {Array.from(PLAYED_PREVIOUSLY.entries())
            .filter(
              ([v]) => !isDJ || (isDJ && v !== PreviouslyPlayed.OtherFormation),
            )
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </FormikField>
      </Field>

      {!utmSource && (
        <Field
          label={
            isDJ
              ? `Wie bist du auf unser Booking aufmerksam geworden?`
              : `Wie seid ihr auf unser Booking aufmerksam geworden?`
          }
        >
          <FormikField
            id="heardAboutBookingFrom"
            as={Select}
            placeholder="bitte auswählen…"
          >
            {Array.from(HEARD_ABOUT.entries()).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </FormikField>
        </Field>
      )}
    </>
  );
}
