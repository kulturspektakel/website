import {Heading, Text, Box, VStack, Flex, Button} from '@chakra-ui/react';
import {Form, Formik} from 'formik';
import {z} from 'zod';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {isValid, printFormat} from 'iban-ts';
import Steps from '../components/Steps';
import {useState} from 'react';
import {Field} from '../components/chakra-snippets/field';
import {Slider} from '../components/chakra-snippets/slider';
import {ConnectedField} from '../components/ConnectedField';
import {RadioCardItem} from '../components/chakra-snippets/radio-card';
import React from 'react';
import {ConnectedRadioCard} from '../components/ConnectedRadioCard';
import ReloadWarning from '../components/ReloadWarning';
import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {seo} from '../utils/seo';
import {useMutation} from '@tanstack/react-query';
import {createMembership} from '../server/routes/mitgliedsantrag';

const MEMBERSHIP_FEES = {
  kult: {
    reduced: 1500,
    regular: 3000,
  },
  foerderverein: {
    reduced: 1500,
    regular: 3000,
  },
} as const;

const membershipEnum = z.enum(['kult', 'foerderverein'], {
  message: 'Bitte Verein wählen',
});

const schemaStep1 = z.object({
  membership: membershipEnum,
  name: z.string().min(1, 'Bitte Name eingeben'),
  address: z.string().min(1, 'Bitte Anschrift eingeben'),
  city: z.string().min(1, 'Bitte PLZ und Ort eingeben'),
  email: z.email('Bitte gültige E-Mail-Adresse eingeben'),
});

const baseFieldsSchema = schemaStep1.extend({
  iban: z
    .string()
    .refine((iban: string) => isValid(iban), 'IBAN hat kein gültiges Format'),
});

// Shared account holder fields
const accountHolderDifferentFields = {
  accountHolder: z.literal('different' as const),
  accountHolderName: z.string().min(1, 'Bitte Name eingeben'),
  accountHolderAddress: z.string().min(1, 'Bitte Anschrift eingeben'),
  accountHolderCity: z.string().min(1, 'Bitte PLZ und Ort eingeben'),
};

const accountHolderSameFields = {
  accountHolder: z.literal('same' as const),
};

// Base schemas for each membership type
const kultBaseSchema = baseFieldsSchema.extend({
  membership: z.literal('kult'),
  membershipType: z.enum(['regular', 'reduced'], {
    message: 'Bitte Beitragsart wählen',
  }),
});

const foerdervereinRegularReducedSchema = baseFieldsSchema.extend({
  membership: z.literal('foerderverein'),
  membershipType: z.enum(['regular', 'reduced'], {
    message: 'Bitte Beitragsart wählen',
  }),
});

const foerdervereinSupporterSchema = baseFieldsSchema.extend({
  membership: z.literal('foerderverein'),
  membershipType: z.literal('supporter'),
  membershipFee: z.coerce
    .number()
    .min(
      MEMBERSHIP_FEES.foerderverein.regular,
      'Bitte einen gültigen Beitrag wählen',
    ),
});

// Schema for kult membership (only regular/reduced allowed)
const kultMembershipSchema = z.discriminatedUnion('accountHolder', [
  kultBaseSchema.extend(accountHolderDifferentFields),
  kultBaseSchema.extend(accountHolderSameFields),
]);

// Schema for foerderverein membership (regular/reduced/supporter allowed)
const foerdervereinMembershipSchema = z.discriminatedUnion('accountHolder', [
  z.discriminatedUnion('membershipType', [
    foerdervereinRegularReducedSchema.extend(accountHolderDifferentFields),
    foerdervereinSupporterSchema.extend(accountHolderDifferentFields),
  ]),
  z.discriminatedUnion('membershipType', [
    foerdervereinRegularReducedSchema.extend(accountHolderSameFields),
    foerdervereinSupporterSchema.extend(accountHolderSameFields),
  ]),
]);

const schemaStep2 = z.discriminatedUnion('membership', [
  kultMembershipSchema,
  foerdervereinMembershipSchema,
]);

const STEPS = [schemaStep1, schemaStep2] as const;
export const schema = schemaStep2;

export const Route = createFileRoute('/mitgliedsantrag')({
  component: Mitgliedsantrag,
  validateSearch: (search): {membership?: z.infer<typeof membershipEnum>} => ({
    membership: membershipEnum.safeParse(search.membership)?.data,
  }),
  head: () =>
    seo({
      title: 'Mitgliedsantrag',
      description: 'Mitgliedsantrag für die Aufnahme in den Verein',
    }),
});

type Membership = z.infer<typeof schemaStep2>;

function Mitgliedsantrag() {
  const navigate = useNavigate();
  const {isPending, isSuccess, mutate} = useMutation<
    void,
    Error,
    z.infer<typeof schema>
  >({
    onSuccess: () =>
      navigate({
        to: '/mitgliedsantrag/danke',
      }),
    mutationFn: (data) => createMembership({data}),
  });

  const [step, setStep] = useState(0);
  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
  const {membership} = Route.useSearch();

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
        initialValues={{membership}}
        validateOnChange={false}
        validateOnBlur={false}
        validationSchema={toFormikValidationSchema(STEPS[step])}
        onSubmit={async (values) => {
          if (step < STEPS.length - 1) {
            setStep(step + 1);
          } else {
            mutate(schema.parse(values));
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
                    required
                    onValueChange={() => {
                      setFieldValue('membershipType', undefined);
                      setFieldValue('membershipFee', undefined);
                    }}
                  >
                    <RadioCardItem
                      label={getLegalName('kult')}
                      description="Für aktive Mitgestalter:innen des Kulturspektakels"
                      value="kult"
                    />
                    <RadioCardItem
                      label={getLegalName('foerderverein')}
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
                        v === 'reduced'
                          ? MEMBERSHIP_FEES[values.membership!].reduced
                          : MEMBERSHIP_FEES[values.membership!].regular,
                      );
                    }}
                  >
                    <RadioCardItem
                      label={currencyFormatter.format(
                        MEMBERSHIP_FEES[values.membership!].regular / 100,
                      )}
                      description="Regulärer Jahresbeitrag"
                      value="regular"
                    />
                    <RadioCardItem
                      label={currencyFormatter.format(
                        MEMBERSHIP_FEES[values.membership!].reduced / 100,
                      )}
                      description="Für Personen ohne/mit vermindertem Einkommen (z.B. Schüler:innen, Studierende)"
                      value="reduced"
                    />
                    {values.membership === 'foerderverein' && (
                      <RadioCardItem
                        label="Freier Beitrag"
                        description="Für unsere großzügigen Unterstützer:innen"
                        value="supporter"
                      />
                    )}
                  </ConnectedRadioCard>

                  {values.membershipType === 'supporter' && (
                    <Field
                      required
                      label="Mitgliedsbeitrag"
                      invalid={Boolean(
                        // @ts-expect-error membershipFee only exists on supporter variant
                        errors.membershipFee,
                      )}
                      // @ts-expect-error membershipFee only exists on supporter variant
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
                          min={MEMBERSHIP_FEES[values.membership!].regular}
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

                  <ConnectedRadioCard name="accountHolder" required>
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
                <Button
                  type="submit"
                  loading={isPending || isSubmitting || isSuccess}
                >
                  {step === STEPS.length - 1 ? 'Mitglied werden' : 'Weiter'}
                </Button>
                {step > 0 && (
                  <Button
                    disabled={isPending || isSubmitting || isSuccess}
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

function getLegalName(name: z.infer<typeof membershipEnum>) {
  switch (name) {
    case 'foerderverein':
      return 'Förderverein Kulturspektakel Gauting e.V.';
    case 'kult':
      return 'Kulturspektakel Gauting e.V.';
  }
}

function getCreditorIdentifier(name: z.infer<typeof membershipEnum>) {
  switch (name) {
    case 'kult':
      return 'DE33ZZZ00000119946';
    case 'foerderverein':
      return 'DE68ZZZ00000117958';
  }
}
