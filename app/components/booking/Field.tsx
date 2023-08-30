import {
  Input,
  useFormControlContext,
  type InputProps,
  FormErrorMessage,
} from '@chakra-ui/react';
import React from 'react';
import {useField} from 'remix-validated-form';

export default function FieldWrapper({
  as = Input,
  onBlur,
  ...props
}: InputProps) {
  const {id, isRequired} = useFormControlContext();
  const field = useField(id);

  console.log(id, field.getInputProps({onBlur}).defaultValue);

  const inputProps: InputProps = {
    ...field.getInputProps({onBlur}),
    isRequired,
    isInvalid: field.error != null,
    bg: 'white',
    ...props,
  };

  return (
    <>
      {React.createElement(as ?? Input, inputProps)}
      {field.error && <FormErrorMessage>{field.error}</FormErrorMessage>}
    </>
  );
}
