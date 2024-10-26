import {
  FormControl,
  FormLabel,
  Heading,
  Text,
  Box,
  Button,
  VStack,
  FormErrorMessage,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Flex,
} from '@chakra-ui/react';
import {Form, Formik} from 'formik';
import Field from '~/components/booking/Field';
import mergeMeta from '~/utils/mergeMeta';
import {z} from 'zod';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {isValid, printFormat} from 'iban-ts';
import RadioStack, {RadioStackTab} from '~/components/RadioStack';
import {gql} from '@apollo/client';
import {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import apolloClient from '~/utils/apolloClient';
import {MembershipQuery, MembershipDocument} from '~/types/graphql';

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

gql`
  query Membership {
    config {
      membershipFees {
        kult {
          regular
          reduced
        }
        foerderverein {
          regular
          reduced
        }
      }
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<MembershipQuery>({
    query: MembershipDocument,
  });
  return typedjson(data);
}

export default function Mitgliedsantrag() {
  const data = useTypedLoaderData<typeof loader>();
  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

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
                    title={getLegalName('kult')}
                    subtitle="Für aktive Mitgestalter:innen des Kulturspektakels"
                    value="kult"
                  />
                  <RadioStackTab
                    title={getLegalName('foerderverein')}
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
                Ich kann jederzeit wieder aus dem Verein austreten, wobei der
                Mitgliedsbeitrag des laufenden Jahres in der Vereinskasse
                verbleibt.
              </p>

              {values.membership && (
                <>
                  <Heading as="h2" size="md" mt="8" textAlign="center">
                    Mitgliedsbeitrag
                  </Heading>

                  <FormControl id="membershipType" isRequired>
                    <RadioStack>
                      <RadioStackTab
                        title={currencyFormatter.format(
                          data.config.membershipFees[values.membership]
                            .regular / 100,
                        )}
                        subtitle="Regulärer Jahresbeitrag"
                        value="regular"
                      />
                      <RadioStackTab
                        title={currencyFormatter.format(
                          data.config.membershipFees[values.membership]
                            .reduced / 100,
                        )}
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
                      <Flex
                        bg="white"
                        p="4"
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="var(--chakra-colors-chakra-border-color)"
                        _focusWithin={{
                          boxShadow: '0 0 0 1px #3182ce',
                          borderColor: '#3182ce',
                        }}
                      >
                        <Slider
                          aria-label="Mitgliedsbeitrag"
                          value={values.membershipFee}
                          min={
                            data.config.membershipFees[values.membership]
                              .regular
                          }
                          max={20000}
                          step={500}
                          onChange={(value) => {
                            setFieldValue('membershipFee', value);
                          }}
                        >
                          <SliderTrack>
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb />
                        </Slider>
                        <Box w="90px" textAlign="right" flexShrink={0}>
                          {new Intl.NumberFormat('de-DE', {
                            style: 'currency',
                            currency: 'EUR',
                          }).format((values.membershipFee ?? 5000) / 100)}
                        </Box>
                      </Flex>
                      <Field
                        as={Slider}
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
                    Ich ermächtige den {getLegalName(values.membership)}{' '}
                    Zahlungen von meinem Konto mittels Lastschrift einzuziehen.
                    Zugleich weise ich mein Kreditinstitut an, die vom{' '}
                    {getLegalName(values.membership)} auf mein Konto gezogenen
                    Lastschriften einzulösen. Die Kontobelastung
                    (Fälligkeitsdatum) des nebenstehenden Betrages erfolgt am
                    31.01. (oder dem folgenden Geschäftstag) jeden Jahres.
                  </Text>
                  <Text fontSize="small" color="offwhite.600">
                    Ich kann innerhalb von acht Wochen, beginnend mit dem
                    Belastungsdatum, die Erstattung des belasteten Betrages
                    verlangen. Es gelten dabei die mit meinem Kreditinstitut
                    vereinbarten Bedingungen.
                  </Text>

                  <Text fontSize="small" color="offwhite.600">
                    Zahlungsempfänger {getLegalName(values.membership)},
                    Bahnhofstr. 6, 82131 Gauting
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
                </>
              )}
            </VStack>
          </Form>
        )}
      </Formik>
    </div>
  );
}

function getLegalName(name: 'kult' | 'foerderverein') {
  switch (name) {
    case 'foerderverein':
      return 'Förderverein Kulturspektakel Gauting e.V.';
    case 'kult':
      return 'Kulturspektakel Gauting e.V.';
    default:
      return 'Unbekannt';
  }
}
