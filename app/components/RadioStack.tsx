import {
  useFormControlContext,
  useRadioGroup,
  Stack,
  UseRadioProps,
  useRadio,
  Box,
  Flex,
  Text,
} from '@chakra-ui/react';
import {useField} from 'formik';
import React from 'react';

export default function RadioStack(props: {
  children: Array<React.ReactElement<RadioStackTabProps>>;
}) {
  const {id} = useFormControlContext();
  const [field] = useField({name: id});
  const {getRootProps, getRadioProps} = useRadioGroup(field);

  // const [customValue, setCustomValue] = useState<string | null>(null);
  // const onChangeCustom = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = event.target.value
  //     .trim()
  //     .split(/,\./)
  //     .map((i) => parseInt(i, 10));

  //   const newValue =
  //     value.length === 1 ? value[0] * 100 : value[0] * 100 + value[1];

  //   if (newValue === field.value) {
  //     return;
  //   }

  //   setCustomValue(newValue.toString());
  //   event.target.value = newValue.toString();
  // };

  return (
    <Stack
      direction={['column', 'row']}
      gap={0}
      mb="5"
      {...getRootProps()}
      borderRadius="var(--chakra-radii-md)"
      borderWidth="1px"
      borderColor="var(--chakra-colors-chakra-border-color)"
      _hover={{
        borderColor: 'gray.300',
      }}
      overflow="hidden"
      _focusWithin={{
        boxShadow: '0 0 0 1px #3182ce',
        borderColor: '#3182ce',
      }}
    >
      {React.Children.map(props.children, (child) =>
        React.cloneElement(child, {
          ...getRadioProps({value: child.props.value}),
        }),
      )}
      {/* <RadioTabs
        title="30,00&nbsp;€"
        subtitle="Jahresbeitrag"
        {...getRadioProps({value: '3000'})}
      />
      <RadioTabs
        title="15,00&nbsp;€"
        subtitle="Ermäßigter Jahresbeitrag für Schüler:innen, Studierende, etc."
        {...getRadioProps({value: '1500'})}
      /> */}
      {/* <RadioTabs
        title={
          <Input
            disabled={value !== 5000}
            type="text"
            placeholder="50,00 €"
            bg="white"
            onBlur={onChangeCustom}
          />
        }
        subtitle="Förderbeitrag"
        {...getRadioProps({value: 5000})}
      /> */}
    </Stack>
  );
}

type RadioStackTabProps = {
  title: React.ReactNode;
  subtitle: string;
} & UseRadioProps;

export function RadioStackTab(props: RadioStackTabProps) {
  const {getInputProps, getRadioProps, getLabelProps} = useRadio(props);

  const [field, meta] = useField({name: props.name!});
  console.log(field);

  return (
    <Box
      as="label"
      p="4"
      bg="white"
      flexBasis="0"
      flexGrow="1"
      cursor="pointer"
      _notFirst={{
        borderTopWidth: [1, 0],
        borderLeftWidth: [0, 1],
        borderColor: 'var(--chakra-colors-chakra-border-color)',
      }}
      _focusWithin={{
        bg: 'gray.50',
      }}
      {...getLabelProps()}
    >
      <input {...field} {...getInputProps()} />
      <Flex direction="row" alignItems="center" mb="1">
        <Box
          {...getRadioProps()}
          w="4"
          h="4"
          mr="2"
          borderRadius="999em"
          flexGrow={0}
          flexShrink={0}
          _checked={{
            bg: 'brand.900',
          }}
          bg="white"
          outline="2px solid blue"
          outlineColor="brand.900"
          borderWidth={2}
          borderColor="white"
        />
        <Text fontWeight="bold">{props.title}</Text>
      </Flex>
      <Text fontSize="small" color="offwhite.600">
        {props.subtitle}
      </Text>
    </Box>
  );
}
