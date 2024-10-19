import {
  FormControl,
  FormLabel,
  Heading,
  Text,
  Box,
  Button,
  VStack,
  FormErrorMessage,
  NumberInputField,
  NumberInput,
} from '@chakra-ui/react';
import {Form, Formik} from 'formik';
import Field from '~/components/booking/Field';
import mergeMeta from '~/utils/mergeMeta';
import {z} from 'zod';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {isValid, printFormat} from 'iban-ts';
import RadioStack, {RadioStackTab} from '~/components/RadioStack';

const accountHolder = z
  .object({
    accountHolderIsDifferent: z.literal('true'),
    accountHolderName: z.string().min(1),
    accountHolderAddress: z.string().min(1),
    accountHolderCity: z.string().min(1),
  })
  .or(
    z.object({
      accountHolderIsDifferent: z.literal('false'),
    }),
  );

const membershipType = z
  .object({
    membershipType: z.literal('reduced').or(z.literal('regular')),
  })
  .or(
    z.object({
      membershipType: z.literal('supporter'),
      membershipFee: z.number().gt(3000),
    }),
  );

const schema = z
  .object({
    membership: z.literal('kult').or(z.literal('foerderverein')),
    name: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    email: z.string().email(),
    iban: z.custom(
      (iban: string) => isValid(iban),
      'IBAN hat kein gültiges Format',
    ),
  })
  .and(membershipType)
  .and(accountHolder);

export const meta = mergeMeta<{}>(() => [
  {title: `Mitgliedsantrag`},
  {
    name: 'description',
    content: 'Mitgliedsantrag für die Aufnahme in den Verein',
  },
]);

type Membership = z.infer<typeof schema>;

export default function Mitglied() {
  return (
    <div>
      <Heading mb="8" textAlign="center">
        Mitgliedsantrag
      </Heading>
      <Formik<Partial<Membership>>
        initialValues={{}}
        validateOnBlur
        validationSchema={toFormikValidationSchema(schema)}
        onSubmit={(values) => {
          console.log(values);
        }}
      >
        {({values, errors, setFieldValue, touched}) => (
          <Form>
            <VStack spacing="4" align="stretch">
              <FormControl id="membership" isRequired>
                <RadioStack>
                  <RadioStackTab
                    title="Kulturspektakel Gauting&nbsp;e.V."
                    subtitle="Für aktive Mitgestalter:innen des Kulturspektakels"
                    value="kult"
                  />
                  <RadioStackTab
                    title="Förderverein Kulturspektakel Gauting&nbsp;e.V."
                    subtitle="Für Unterstützer:innen des Kulturspektakels"
                    value="foerderverein"
                  />
                </RadioStack>
              </FormControl>
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
                austreten, wobei der Mitgliedsbeitrag des laufenden Jahres in
                der Vereinskasse verbleibt.
              </p>

              <Heading as="h2" size="md" mt="8" textAlign="center">
                Mitgliedsbeitrag
              </Heading>

              <FormControl id="membershipType" isRequired>
                <RadioStack>
                  <RadioStackTab
                    title="30,00&nbsp;€"
                    subtitle="Regulärer Jahresbeitrag"
                    value="regular"
                  />
                  <RadioStackTab
                    title="15,00&nbsp;€"
                    subtitle="Für Personen ohne/mit vermindertem Einkommen (z.B. Schüler:innen, Studierende)"
                    value="reduced"
                  />
                  {values.membership === 'foerderverein' && (
                    <RadioStackTab
                      title="Freier Beitrag"
                      subtitle="Für unsere großzügigen Unterstützer:innen"
                      value="supporter"
                    />
                  )}
                </RadioStack>
              </FormControl>

              {values.membershipType === 'supporter' && (
                <FormControl id="membershipFee" isRequired>
                  <FormLabel>Mitgliedsbeitrag</FormLabel>
                  {/* <NumberInput> */}
                  <Field
                    // as={NumberInputField}
                    onBlur={(e) => {
                      setFieldValue(
                        'membershipFee',
                        new Intl.NumberFormat('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(parseFloat(String(e))),
                      );
                    }}
                  />
                  {/* </NumberInput> */}
                </FormControl>
              )}

              <FormControl
                id="iban"
                isRequired
                isInvalid={touched.iban && !!errors.iban}
              >
                <FormLabel>IBAN</FormLabel>
                <Field
                  type="text"
                  onBlur={(e) => {
                    if (isValid(e.target.value)) {
                      setFieldValue('iban', printFormat(e.target.value));
                    }
                  }}
                />
                <FormErrorMessage>
                  {typeof errors.iban === 'string' ? errors.iban : ''}
                </FormErrorMessage>
              </FormControl>

              <FormControl id="accountHolderIsDifferent" isRequired>
                <RadioStack>
                  <RadioStackTab
                    title="Mitglied ist Kontoinhaber:in"
                    subtitle="Das Mitglied ist gleichzeitig Kontoinhaber:in"
                    value="false"
                  />
                  <RadioStackTab
                    title="Abweichender Kontoinhaber"
                    subtitle="Kontoinhaber:in ist eine andere Person als das Mitglied"
                    value="true"
                  />
                </RadioStack>
              </FormControl>

              {values.accountHolderIsDifferent === 'true' && (
                <>
                  <FormControl id="accountHolder" isRequired>
                    <FormLabel>Name des/der Kontoinhaber:in</FormLabel>
                    <Field type="text" />
                  </FormControl>
                  <FormControl id="accountHolderAddress" isRequired>
                    <FormLabel>Adresse des/der Kontoinhaber:in</FormLabel>
                    <Field type="text" />
                  </FormControl>
                  <FormControl id="accountHolderCity" isRequired>
                    <FormLabel>PLZ, Ort des/der Kontoinhaber:in</FormLabel>
                    <Field type="text" />
                  </FormControl>
                </>
              )}
              <Text fontSize="small" color="offwhite.600">
                Ich ermächtige den Kulturspektakel Gauting e.V. Zahlungen von
                meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich
                mein Kreditinstitut an, die vom Kulturspektakel Gauting e.V. auf
                mein Konto gezogenen Lastschriften einzulösen. Die
                Kontobelastung (Fälligkeitsdatum) des nebenstehenden Betrages
                erfolgt am 31.01. (oder dem folgenden Geschäftstag) jeden
                Jahres.
              </Text>
              <Text fontSize="small" color="offwhite.600">
                Ich kann innerhalb von acht Wochen, beginnend mit dem
                Belastungsdatum, die Erstattung des belasteten Betrages
                verlangen. Es gelten dabei die mit meinem Kreditinstitut
                vereinbarten Bedingungen.
              </Text>

              <Text fontSize="small" color="offwhite.600">
                Zahlungsempfänger Kulturspektakel Gauting e.V., Bahnhofstr. 6,
                82131 Gauting
                <br />
                Gläubiger-Identifikationsnummer DE33ZZZ00000119946
              </Text>

              <Text fontSize="small" color="offwhite.600">
                Die Mandatsreferenz-Nummer wird der/dem Kontoinhaber:in mit
                einer separaten Ankündigung über den erstmaligen Einzug des
                Lastschriftsbetrags mitgeteilt.
              </Text>

              <Box textAlign="right">
                <Button variant="primary" type="submit" isLoading={false}>
                  Absenden
                </Button>
              </Box>
            </VStack>
          </Form>
        )}
      </Formik>
    </div>
  );
}
