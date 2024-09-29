import {
  FormControl,
  FormLabel,
  Heading,
  Checkbox,
  Text,
  Input,
  useRadio,
  Box,
  Stack,
  useRadioGroup,
  Button,
  Flex,
} from '@chakra-ui/react';
import {Form, Formik} from 'formik';
import Field from '~/components/booking/Field';
import mergeMeta from '~/utils/mergeMeta';
import {z} from 'zod';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {isValid} from 'iban-ts';
import {useCallback, useState} from 'react';

const accountHolder = z
  .object({
    accountHolderIsDifferent: z.literal(true),
    accountHolderName: z.string().min(1),
    accountHolderAddress: z.string().min(1),
    accountHolderCity: z.string().min(1),
  })
  .or(
    z.object({
      accountHolderIsDifferent: z.literal(false),
    }),
  );

const schema = z
  .object({
    membership: z.literal('kult').or(z.literal('foerderverein')),
    name: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    email: z.string().email(),
    iban: z.custom((iban: string) => isValid(iban)),
    membershipFee: z.literal(1500).or(z.literal(3000)).or(z.number().gt(3000)),
  })
  .and(accountHolder);

export const meta = mergeMeta<{}>(() => [
  {title: `Mitgliedsantrag`},
  {
    name: 'description',
    content: 'Mitgliedsantrag für die Aufnahme in den Verein',
  },
]);

function MembershipFee({
  onChange,
  value,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [customValue, setCustomValue] = useState<string | null>(null);
  const {getRootProps, getRadioProps} = useRadioGroup({
    name: 'membershipFee',
    defaultValue: '3000',
    onChange: (value) => onChange(parseInt(value)),
  });

  const onChangeCustom = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
      .trim()
      .split(/,\./)
      .map((i) => parseInt(i, 10));

    const newValue =
      value.length === 1 ? value[0] * 100 : value[0] * 100 + value[1];

    setCustomValue(newValue.toString());
    onChange(newValue);
    event.target.value = newValue.toString();
  };

  const group = getRootProps();

  return (
    <Stack
      direction={['column', 'row']}
      gap={0}
      mb="5"
      {...group}
      borderRadius="var(--chakra-radii-md)"
      borderWidth="1px"
      borderColor="var(--chakra-colors-chakra-border-color)"
      _hover={{
        borderColor: 'var(--chakra-colors-gray-300)',
      }}
      overflow="hidden"
    >
      <RadioTabs
        title="30,00&nbsp;€"
        subtitle="Jahresbeitrag"
        value="3000"
        {...getRadioProps({value})}
      />
      <RadioTabs
        title="15,00&nbsp;€"
        subtitle="Ermäßigter Jahresbeitrag für Schüler:innen, Studierende, etc."
        value="1500"
      />
      <RadioTabs
        title={
          <Input type="text" placeholder="50,00" onBlur={onChangeCustom} />
        }
        value={customValue}
        subtitle="Förderbeitrag"
      />
    </Stack>
  );
}

function RadioTabs(props: {
  title: React.ReactNode;
  subtitle: string;
  value: string;
}) {
  const {getInputProps, getRadioProps} = useRadio(props);

  const input = getInputProps();
  const checkbox = getRadioProps();

  return (
    <Box
      p="4"
      bg="white"
      flexBasis="0"
      flexGrow="1"
      cursor="pointer"
      _checked={{
        bg: 'teal.600',
        color: 'white',
        borderColor: 'teal.600',
      }}
    >
      <Flex direction="row" alignItems="center">
        <Box
          w="4"
          h="4"
          mr="2"
          borderRadius="999em"
          bg={checkbox.isChecked ? 'brand.600' : 'white'}
          outline="2px solid blue"
          outlineColor="brand.900"
          borderWidth={2}
          borderColor="white"
        />
        <Text fontWeight="strong">{props.title}</Text>
      </Flex>
      <Text color="offwhite.500">{props.subtitle}</Text>
    </Box>
  );
}

type Membership = z.infer<typeof schema>;

export default function Mitglied() {
  return (
    <div>
      <Heading mb="8">Mitgliedsantrag</Heading>
      <Formik<Membership>
        initialValues={{}}
        validationSchema={toFormikValidationSchema(schema)}
        onSubmit={(values) => {
          console.log(values);
        }}
      >
        {({values, isValid}) => (
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
            <MembershipFee />

            <FormControl id="iban" isRequired>
              <FormLabel>IBAN</FormLabel>
              <Field type="text" />
            </FormControl>

            <FormControl id="accountHolderIsDifferent" isRequired>
              <Checkbox>Kontoinhaber:in ist abweichend vom Mitglied</Checkbox>
            </FormControl>

            {values.accountHolderIsDifferent && (
              <>
                <FormControl id="accountHolder" isRequired>
                  <FormLabel>Name des/der Kontoinhaber:in</FormLabel>
                  <Field type="text" />
                </FormControl>
              </>
            )}
            <Text mb="5" size="sm" color="offwhite.600">
              Ich ermächtige den Kulturspektakel Gauting e.V. Zahlungen von
              meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich
              mein Kreditinstitut an, die vom Kulturspektakel Gauting e.V. auf
              mein Konto gezogenen Lastschriften einzulösen. Die Kontobelastung
              (Fälligkeitsdatum) des nebenstehenden Betrages erfolgt am 31.01.
              (oder dem folgenden Geschäftstag) jeden Jahres.
            </Text>
            <Text mb="5" size="sm" color="offwhite.600">
              Ich kann innerhalb von acht Wochen, beginnend mit dem
              Belastungsdatum, die Erstattung des belasteten Betrages verlangen.
              Es gelten dabei die mit meinem Kreditinstitut vereinbarten
              Bedingungen.
            </Text>

            <Text mb="5" size="sm" color="offwhite.600">
              Zahlungsempfänger Kulturspektakel Gauting e.V., Bahnhofstr. 6,
              82131 Gauting
              <br />
              Gläubiger-Identifikationsnummer DE33ZZZ00000119946
            </Text>

            <Text mb="5" size="sm" color="offwhite.600">
              Die Mandatsreferenz-Nummer wird dem Kontoinhaber mit einer
              separaten Ankündigung über den erstmaligen Einzug des
              Lastschriftsbetrags mitgeteilt.
            </Text>

            <Box textAlign="right" mt="8">
              <Button variant="primary" type="submit" isLoading={false}>
                Absenden
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
    </div>
  );
}
