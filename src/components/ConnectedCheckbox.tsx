import {Field, FieldProps} from './chakra-snippets/field';
import {Checkbox, Flex} from '@chakra-ui/react';
import {FieldConfig, useField} from 'formik';

export function ConnectedCheckbox({
  label,
  name,
  validate,
  ...rest
}: {
  label: React.ReactNode;
} & Pick<FieldConfig, 'name' | 'validate'> &
  Omit<FieldProps, 'children'>) {
  const [_, {value}, {setValue}] = useField({name, validate});
  return (
    <Field {...rest}>
      <Checkbox.Root>
        <Checkbox.HiddenInput
          value={value}
          onChange={(e) => setValue(e.target.checked)}
        />
        <Flex background="white" borderRadius="sm" display="inline" height="5">
          <Checkbox.Control />
        </Flex>
        <Checkbox.Label>{label}</Checkbox.Label>
      </Checkbox.Root>
    </Field>
  );
}
