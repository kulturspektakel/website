import {
  Heading,
  Text,
  Box,
  Button,
  VStack,
  Flex,
  RadioCardRoot,
  HStack,
  RadioCardItem,
  Input,
} from '@chakra-ui/react';
import {Field as FormikField, Form, Formik} from 'formik';
import mergeMeta from '~/utils/mergeMeta';
import {z} from 'zod';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {isValid, printFormat} from 'iban-ts';
import {gql} from '@apollo/client';
import {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import apolloClient from '~/utils/apolloClient';
import {
  MembershipQuery,
  MembershipDocument,
  useCreateMembershipMutation,
  MembershipType,
  Membership as MembershipEnum,
} from '~/types/graphql';
import Steps from '~/components/Steps';
import {useState} from 'react';
import {useNavigate} from '@remix-run/react';
import {$path} from 'remix-routes';
import {Field} from '~/components/chakra-snippets/field';
import {Slider} from '~/components/chakra-snippets/slider';

const schemaStep1 = z.object({
  membership: z.nativeEnum(MembershipEnum),
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  email: z.string().email(),
});

const feeSchema = schemaStep1.extend({
  membershipFee: z.coerce.number(),
  membershipType: z.nativeEnum(MembershipType),
  iban: z
    .string()
    .refine((iban: string) => isValid(iban), 'IBAN hat kein gültiges Format'),
});

const schemaStep2 = z
  .discriminatedUnion('accountHolder', [
    feeSchema.extend({
      accountHolder: z.literal('different'),
      accountHolderName: z.string().min(1),
      accountHolderAddress: z.string().min(1),
      accountHolderCity: z.string().min(1),
    }),
    feeSchema.extend({
      accountHolder: z.literal('same'),
    }),
  ])
  .refine(
    ({membership, membershipType}) =>
      !(membership !== 'foerderverein' && membershipType === 'supporter'),
    {
      path: ['membershipType'],
      message: 'Unterstützer:innen können nur im Förderverein Mitglied werden',
    },
  );

const STEPS = [schemaStep1, schemaStep2] as const;

export const meta = mergeMeta<{}>(() => [
  {title: `Mitgliedsantrag`},
  {
    name: 'description',
    content: 'Mitgliedsantrag für die Aufnahme in den Verein',
  },
]);

type Membership = z.infer<typeof schemaStep2>;

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

gql`
  mutation CreateMembership($data: MembershipApplication!) {
    createMembershipApplication(data: $data)
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
  const navigate = useNavigate();
  const [create, {loading}] = useCreateMembershipMutation();
  const [step, setStep] = useState(0);
  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <div>
      <Heading mb="8" textAlign="center">
        Mitgliedsantrag
      </Heading>
      <Steps
        mb="8"
        display={['none', 'flex']}
        steps={['Kontaktdaten', 'Mitgliedsbeitrag', 'Absenden']}
        currentStep={step}
      />

      <Formik<Partial<Membership>>
        initialValues={{}}
        validateOnBlur
        validationSchema={toFormikValidationSchema(STEPS[step])}
        onSubmit={async (values) => {
          if (step < STEPS.length - 1) {
            setStep(step + 1);
          } else {
            const data = schemaStep2.parse(values);
            delete data.accountHolder;
            await create({
              variables: {
                data: data,
              },
            });
            navigate($path('/mitgliedsantrag/danke'));
          }
        }}
      >
        {({values, errors, setFieldValue, touched}) => (
          <Form>
            <VStack gap="4" align="stretch">
              {step == 0 ? (
                <>
                  <FormControl id="membership" isRequired>
                    <RadioCardRoot>
                      <HStack align="stretch">
                        <RadioCardItem
                          label={getLegalName('kult')}
                          description="Für aktive Mitgestalter:innen des Kulturspektakels"
                          value="kult"
                        />
                        <RadioCardItem
                          label={getLegalName('foerderverein')}
                          subtitle="Für Unterstützer:innen des Kulturspektakels"
                          value="foerderverein"
                        />
                      </HStack>
                    </RadioCardRoot>
                  </FormControl>
                  <Field label="Vor- und Nachname" required>
                    <FormikField as={Input} type="text" id="name" />
                  </Field>
                  <Field label="Anschrift" required>
                    <FormikField as={Input} type="text" id="address" />
                  </Field>
                  <Field label="PLZ, Ort" required>
                    <FormikField as={Input} type="text" id="city" />
                  </Field>

                  <Field label="E-Mail" required>
                    <FormikField type="email" id="email" />
                  </Field>

                  <Text fontSize="small" color="offwhite.600">
                    Ich kann jederzeit wieder aus dem Verein austreten, wobei
                    der Mitgliedsbeitrag des laufenden Jahres in der
                    Vereinskasse verbleibt.
                  </Text>
                </>
              ) : (
                <>
                  <FormControl id="membershipType" isRequired>
                    <RadioCardRoot>
                      <HStack align="stretch">
                        <RadioCardItem
                          label={currencyFormatter.format(
                            data.config.membershipFees[values.membership!]
                              .regular / 100,
                          )}
                          description="Regulärer Jahresbeitrag"
                          value="regular"
                        />
                        <RadioCardItem
                          label={currencyFormatter.format(
                            data.config.membershipFees[values.membership!]
                              .reduced / 100,
                          )}
                          description="Für Personen ohne/mit vermindertem Einkommen (z.B. Schüler:innen, Studierende)"
                          value="reduced"
                        />
                        {values.membership! === 'foerderverein' && (
                          <RadioCardItem
                            label="Freier Beitrag"
                            description="Für unsere großzügigen Unterstützer:innen"
                            value="supporter"
                          />
                        )}
                      </HStack>
                    </RadioCardRoot>
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
                          value={[values.membershipFee!]}
                          min={
                            data.config.membershipFees[values.membership!]
                              .regular
                          }
                          max={20000}
                          step={500}
                          onChange={(value) => {
                            setFieldValue('membershipFee', value);
                          }}
                        />
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

                  <Field
                    label="IBAN"
                    required
                    invalid={touched.iban && !!errors.iban}
                    errorText={
                      typeof errors.iban === 'string' ? errors.iban : null
                    }
                  >
                    <FormikField
                      as={Input}
                      id="iban"
                      type="text"
                      onBlur={(e) => {
                        if (isValid(e.target.value)) {
                          setFieldValue('iban', printFormat(e.target.value));
                        }
                      }}
                    />
                  </Field>

                  <FormControl id="accountHolder" isRequired>
                    <RadioCardRoot>
                      <HStack align="stretch">
                        <RadioCardItem
                          label="Mitglied ist Kontoinhaber:in"
                          description="Das Mitglied ist gleichzeitig Kontoinhaber:in"
                          value="same"
                        />
                        <RadioCardItem
                          label="Abweichender Kontoinhaber"
                          description="Kontoinhaber:in ist eine andere Person als das Mitglied"
                          value="different"
                        />
                      </HStack>
                    </RadioCardRoot>
                  </FormControl>
                  {values.accountHolder === 'different' && (
                    <>
                      <Field required label="Name des/der Kontoinhaber:in">
                        <FormikField id="accountHolderName" type="text" />
                      </Field>
                      <Field required label="Anschrift des/der Kontoinhaber:in">
                        <FormikField id="accountHolderAddress" type="text" />
                      </Field>
                      <Field required label="PLZ, Ort des/der Kontoinhaber:in">
                        <FormikField id="accountHolderCity" type="text" />
                      </Field>
                    </>
                  )}
                  <Text fontSize="small" color="offwhite.600">
                    Ich ermächtige den {getLegalName(values.membership!)}{' '}
                    Zahlungen von meinem Konto mittels Lastschrift einzuziehen.
                    Zugleich weise ich mein Kreditinstitut an, die vom{' '}
                    {getLegalName(values.membership!)} auf mein Konto gezogenen
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
                    Zahlungsempfänger {getLegalName(values.membership!)},
                    Bahnhofstr. 6, 82131 Gauting
                    <br />
                    Gläubiger-Identifikationsnummer DE33ZZZ00000119946
                  </Text>

                  <Text fontSize="small" color="offwhite.600">
                    Die Mandatsreferenz-Nummer wird der/dem Kontoinhaber:in mit
                    einer separaten Ankündigung über den erstmaligen Einzug des
                    Lastschriftsbetrags mitgeteilt.
                  </Text>
                </>
              )}
              <Flex justifyContent="space-between" flexDirection="row-reverse">
                <Button variant="primary" type="submit" isLoading={loading}>
                  {step === STEPS.length - 1 ? 'Absenden' : 'Weiter'}
                </Button>
                {step > 0 && (
                  <Button
                    disabled={loading}
                    variant="secondary"
                    onClick={() => setStep(step - 1)}
                  >
                    Zurück
                  </Button>
                )}
              </Flex>
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
