import {
  FormControl,
  FormLabel,
  FormHelperText,
  Heading,
  Checkbox,
  RadioGroup,
  Radio,
  VStack,
  Input,
} from '@chakra-ui/react';
import {Form, Formik} from 'formik';
import Field from '~/components/booking/Field';
import mergeMeta from '~/utils/mergeMeta';

export const meta = mergeMeta<{}>(() => [
  {title: `Mitgliedsantrag`},
  {
    name: 'description',
    content: 'Mitgliedsantrag für die Aufnahme in den Verein',
  },
]);

export default function Mitglied() {
  return (
    <div>
      <Heading>Mitgliedsantrag</Heading>
      <Formik
        initialValues={{}}
        onSubmit={(values) => {
          console.log(values);
        }}
      >
        <Form>
          <FormControl id="name" isRequired>
            <FormLabel>Name</FormLabel>
            <Field type="text" />
          </FormControl>
          <FormControl id="address" isRequired>
            <FormLabel>Adresse</FormLabel>
            <Field type="text" />
          </FormControl>
          <FormControl id="city" isRequired>
            <FormLabel>PLZ, Ort</FormLabel>
            <Field type="text" />
          </FormControl>

          <FormControl id="email" isRequired>
            <FormLabel>E-Mail</FormLabel>
            <Field type="email" />
          </FormControl>

          <p>
            Ich kann jederzeit wieder aus dem Kulturspektakel Gauting e.V.
            austreten, wobei der Mitgliedsbeitrag des laufenden Jahres in der
            Vereinskasse verbleibt.
          </p>

          <Heading as="h2" size="md" mt="8" mb="5">
            Mitgliedsbeitrag
          </Heading>
          <RadioGroup>
            <VStack align="start">
              <Radio value="option1">30,00&nbsp;€ Jahresbeitrag</Radio>
              <Radio value="option2">
                15,00&nbsp;€ Ermäßigter Jahresbeitrag
                <br />
                bei gemindertem Einkommen, z.B. Schüler:innen oder Studierende
              </Radio>
              <Radio value="option3">
                <Input type="number" />
              </Radio>
            </VStack>
          </RadioGroup>

          <FormControl id="iban" isRequired>
            <FormLabel>IBAN</FormLabel>
            <Field type="text" />
          </FormControl>

          <Checkbox>Kontoinhaber:in ist abweichend vom Mitglied</Checkbox>

          <FormControl id="accountHolder" isRequired>
            <FormLabel>Name des/der Kontoinhaber:in</FormLabel>
            <Field type="text" />
          </FormControl>

          <p>
            Ich ermächtige den Kulturspektakel Gauting e.V. Zahlungen von meinem
            Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein
            Kreditinstitut an, die vom Kulturspektakel Gauting e.V. auf mein
            Konto gezogenen Lastschriften einzulösen. Die Kontobelastung
            (Fälligkeitsdatum) des nebenstehenden Betrages erfolgt am 31.01.
            (oder dem folgenden Geschäftstag) jeden Jahres.
          </p>
          <p>
            Ich kann innerhalb von acht Wochen, beginnend mit dem
            Belastungsdatum, die Erstattung des belasteten Betrages verlangen.
            Es gelten dabei die mit meinem Kreditinstitut vereinbarten
            Bedingungen.
          </p>

          <p>
            Zahlungsempfänger Kulturspektakel Gauting e.V., Bahnhofstr. 6, 82131
            Gauting
            <br />
            Gläubiger-Identifikationsnummer DE33ZZZ00000119946
          </p>

          <p>
            Die Mandatsreferenz-Nummer wird dem Kontoinhaber mit einer separaten
            Ankündigung über den erstmaligen Einzug des Lastschriftsbetrags
            mitgeteilt.
          </p>
        </Form>
      </Formik>
    </div>
  );
}
