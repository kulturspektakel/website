import {
  useFormControlContext,
  useRadioGroup,
  Stack,
  useRadio,
  Box,
  Flex,
  Text,
} from '@chakra-ui/react';
import {useField} from 'formik';
import React, {useEffect} from 'react';

export default function RadioStack(props: {
  children: Array<React.ReactElement<RadioStackTabProps> | boolean>;
  onChangeEffect?: (value: string) => void;
  autoFocus?: boolean;
}) {
  const {id} = useFormControlContext();
  const [field] = useField({name: id, autoFocus: props.autoFocus});
  const {getRootProps} = useRadioGroup(field);

  useEffect(() => {
    if (props.onChangeEffect) {
      props.onChangeEffect(field.value);
    }
  }, [field.value]);

  return (
    <Stack
      direction={['column', 'row']}
      gap={0}
      {...getRootProps()}
      borderRadius="md"
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
      {props.children}
    </Stack>
  );
}

type RadioStackTabProps = {
  title: React.ReactNode;
  subtitle: string;
  value: string;
};

export function RadioStackTab({title, subtitle, value}: RadioStackTabProps) {
  const {id} = useFormControlContext();
  const [field] = useField({name: id});
  const {getInputProps, getRadioProps, getLabelProps} = useRadio({
    ...field,
    value,
    isChecked: value === field.value,
  });

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
      <input {...getInputProps()} />
      <Flex direction="row" alignItems="top" mb="1">
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
        <Text fontWeight="bold" lineHeight="120%" mt="-1px">
          {title}
        </Text>
      </Flex>
      <Text ml="6" fontSize="small" color="offwhite.600">
        {subtitle}
      </Text>
    </Box>
  );
}
