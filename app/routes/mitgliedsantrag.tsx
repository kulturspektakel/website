import {Heading, Text, Box, VStack, Flex} from '@chakra-ui/react';
import {Form, Formik} from 'formik';
import {z} from 'zod';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {isValid, printFormat} from 'iban-ts';
import {gql} from '@apollo/client';
import apolloClient from '../utils/apolloClient';
import {
  MembershipQuery,
  MembershipDocument,
  useCreateMembershipMutation,
  MembershipType,
  Membership as MembershipEnum,
} from '../types/graphql';
import Steps from '../components/Steps';
import {useState} from 'react';
import {Field} from '../components/chakra-snippets/field';
import {Slider} from '../components/chakra-snippets/slider';
import {Button} from '../components/chakra-snippets/button';
import {ConnectedField} from '../components/ConnectedField';
import {RadioCardItem} from '../components/chakra-snippets/radio-card';
import React from 'react';
import {ConnectedRadioCard} from '../components/ConnectedRadioCard';
import ReloadWarning from '../components/ReloadWarning';
import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';

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

const loader = createServerFn().handler(async () => {
  const {data} = await apolloClient.query<MembershipQuery>({
    query: MembershipDocument,
  });
  return data;
});

export const Route = createFileRoute('/mitgliedsantrag')({
  component: Mitgliedsantrag,
  loader: async () => await loader(),
  head: () =>
    seo({
      title: 'Mitgliedsantrag',
      description: 'Mitgliedsantrag für die Aufnahme in den Verein',
    }),
});

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

function Mitgliedsantrag() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [create, {loading}] = useCreateMembershipMutation();
  const [step, setStep] = useState(0);
  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <div>
      <Heading mb="8" textAlign="center" size="3xl">
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
        validateOnChange={false}
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
            navigate({
              to: '/mitgliedsantrag/danke',
            });
          }
        }}
      >
        {({values, errors, setFieldValue, dirty, isSubmitting}) => (
          <Form>
            <ReloadWarning dirty={dirty && !isSubmitting} />
            <VStack gap="4" align="stretch">
              {step == 0 ? (
                <React.Fragment key="step1">
                  <ConnectedRadioCard
                    name="membership"
                    onValueChange={() => {
                      setFieldValue('membershipType', undefined);
                      setFieldValue('membershipFee', undefined);
                    }}
                  >
                    <RadioCardItem
                      label={getLegalName(MembershipEnum.Kult)}
                      description="Für aktive Mitgestalter:innen des Kulturspektakels"
                      value="kult"
                    />
                    <RadioCardItem
                      label={getLegalName(MembershipEnum.Foerderverein)}
                      description="Für Unterstützer:innen des Kulturspektakels"
                      value="foerderverein"
                    />
                  </ConnectedRadioCard>

                  <ConnectedField
                    name="name"
                    label="Vor- und Nachname"
                    required
                  />
                  <ConnectedField name="address" label="Anschrift" required />

                  <ConnectedField name="city" label="PLZ, Ort" required />

                  <ConnectedField
                    name="email"
                    label="E-Mail"
                    required
                    type="email"
                  />

                  <Text fontSize="small" color="offwhite.600">
                    Ich kann jederzeit wieder aus dem Verein austreten, wobei
                    der Mitgliedsbeitrag des laufenden Jahres in der
                    Vereinskasse verbleibt.
                  </Text>
                </React.Fragment>
              ) : (
                <React.Fragment key="step2">
                  <ConnectedRadioCard
                    name="membershipType"
                    onValueChange={(v) => {
                      setFieldValue(
                        'membershipFee',
                        v === MembershipType.Reduced
                          ? data.config.membershipFees[values.membership!]
                              .reduced
                          : data.config.membershipFees[values.membership!]
                              .regular,
                      );
                    }}
                  >
                    <RadioCardItem
                      label={currencyFormatter.format(
                        data.config.membershipFees[values.membership!].regular /
                          100,
                      )}
                      description="Regulärer Jahresbeitrag"
                      value={MembershipType.Regular}
                    />
                    <RadioCardItem
                      label={currencyFormatter.format(
                        data.config.membershipFees[values.membership!].reduced /
                          100,
                      )}
                      description="Für Personen ohne/mit vermindertem Einkommen (z.B. Schüler:innen, Studierende)"
                      value={MembershipType.Reduced}
                    />
                    {values.membership === MembershipEnum.Foerderverein && (
                      <RadioCardItem
                        label="Freier Beitrag"
                        description="Für unsere großzügigen Unterstützer:innen"
                        value={MembershipType.Supporter}
                      />
                    )}
                  </ConnectedRadioCard>

                  {values.membershipType === MembershipType.Supporter && (
                    <Field
                      required
                      label="Mitgliedsbeitrag"
                      invalid={Boolean(errors.membershipFee)}
                      errorText={errors.membershipFee}
                    >
                      <Flex
                        direction="row"
                        w="full"
                        bg="white"
                        p="4"
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="var(--chakra-colors-border)"
                        _focusWithin={{
                          boxShadow: '0 0 0 1px var(--chakra-colors-black)',
                          borderColor: 'var(--focus-ring-color);',
                        }}
                      >
                        <Slider
                          value={[values.membershipFee!]}
                          min={
                            data.config.membershipFees[values.membership!]
                              .regular
                          }
                          max={20000}
                          mt="0.5"
                          w="full"
                          step={500}
                          onValueChange={({value}) => {
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
                    </Field>
                  )}

                  <ConnectedField
                    label="IBAN"
                    required
                    name="iban"
                    validate={(v) =>
                      isValid(v) ? undefined : 'IBAN hat kein gültiges Format'
                    }
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                      if (isValid(e.target.value)) {
                        setFieldValue('iban', printFormat(e.target.value));
                      }
                    }}
                  />

                  <ConnectedRadioCard name="accountHolder">
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
                  </ConnectedRadioCard>
                  {values.accountHolder === 'different' && (
                    <>
                      <ConnectedField
                        name="accountHolderName"
                        required
                        label="Name des/der Kontoinhaber:in"
                      />
                      <ConnectedField
                        name="accountHolderAddress"
                        required
                        label="Anschrift des/der Kontoinhaber:in"
                      />
                      <ConnectedField
                        name="accountHolderCity"
                        required
                        label="PLZ, Ort des/der Kontoinhaber:in"
                      />
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
                    Gläubiger-Identifikationsnummer{' '}
                    {getCreditorIdentifier(values.membership!)}
                  </Text>

                  <Text fontSize="small" color="offwhite.600">
                    Die Mandatsreferenz-Nummer wird der/dem Kontoinhaber:in mit
                    einer separaten Ankündigung über den erstmaligen Einzug des
                    Lastschriftsbetrags mitgeteilt.
                  </Text>
                </React.Fragment>
              )}
              <Flex justifyContent="space-between" flexDirection="row-reverse">
                <Button type="submit" loading={loading}>
                  {step === STEPS.length - 1 ? 'Mitglied werden' : 'Weiter'}
                </Button>
                {step > 0 && (
                  <Button
                    disabled={loading}
                    variant="subtle"
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

function getLegalName(name: MembershipEnum) {
  switch (name) {
    case 'foerderverein':
      return 'Förderverein Kulturspektakel Gauting e.V.';
    case 'kult':
      return 'Kulturspektakel Gauting e.V.';
  }
}

function getCreditorIdentifier(name: MembershipEnum) {
  switch (name) {
    case 'kult':
      return 'DE33ZZZ00000119946';
    case 'foerderverein':
      return 'DE68ZZZ00000117958';
  }
}
