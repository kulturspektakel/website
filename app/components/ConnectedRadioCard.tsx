import {Stack} from '@chakra-ui/react';
import {Field, FieldProps} from './chakra-snippets/field';
import {RadioCardRoot} from './chakra-snippets/radio-card';
import {useField} from 'formik';

export function ConnectedRadioCard({
  children,
  onValueChange,
  ...props
}: FieldProps & {
  name: string;
  onValueChange?: (value: string) => void;
  children: Array<
    React.ReactElement<React.ComponentProps<typeof RadioCardRoot>> | false
  >;
}) {
  const [_, {error, value}, {setValue}] = useField(props.name);
  return (
    <Field invalid={Boolean(error)} errorText={error} {...props}>
      <RadioCardRoot
        w="full"
        value={value}
        onValueChange={({value}) => {
          setValue(value);
          onValueChange?.(value);
        }}
      >
        <Stack direction={{base: 'column', sm: 'row'}}>{children}</Stack>
      </RadioCardRoot>
    </Field>
  );
}
