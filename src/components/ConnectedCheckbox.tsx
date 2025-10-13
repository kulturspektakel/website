import {Field} from './chakra-snippets/field';
import {Checkbox, Flex} from '@chakra-ui/react';
import {FieldConfig, GenericFieldHTMLAttributes, useField} from 'formik';

export function ConnectedCheckbox({
  label,
  ...props
}: {
  label: React.ReactNode;
} & GenericFieldHTMLAttributes &
  FieldConfig) {
  const [_, {value}, {setValue}] = useField(props.name);
  return (
    <Field type="checkbox" {...props}>
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
