import {Input, NativeSelectField, Text} from '@chakra-ui/react';
import {Field as ChakraField} from './chakra-snippets/field';
import {
  FieldConfig,
  Field as FormikField,
  GenericFieldHTMLAttributes,
  useField,
} from 'formik';
import * as React from 'react';
import {NativeSelectRoot} from './chakra-snippets/native-select';

export const ConnectedField = React.forwardRef<
  HTMLDivElement,
  {
    label?: React.ReactNode;
    description?: React.ReactNode;
    helperText?: React.ReactNode;
    errorText?: React.ReactNode;
    optionalText?: React.ReactNode;
    options?: Array<{
      value: string;
      label: string;
    }>;
  } & GenericFieldHTMLAttributes &
    FieldConfig
>(function Field(props, ref) {
  const {
    label,
    children,
    helperText,
    errorText,
    optionalText,
    name,
    required,
    description,
    options,
    ...rest
  } = props;

  const [{}, {error}] = useField(name);

  return (
    <ChakraField
      required={required}
      label={label}
      helperText={helperText}
      invalid={Boolean(error)}
      errorText={error || errorText}
      optionalText={optionalText}
      ref={ref}
    >
      {description && (
        <Text mt="1" fontSize="sm" color="fg.muted">
          {description}
        </Text>
      )}
      {options ? (
        <NativeSelectRoot>
          <FormikField
            name={name}
            as={NativeSelectField}
            placeholder="bitte auswählen…"
            {...rest}
          >
            {options.map(({value, label}) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </FormikField>
        </NativeSelectRoot>
      ) : (
        (children ?? <FormikField name={name} as={Input} {...rest} />)
      )}
    </ChakraField>
  );
});
