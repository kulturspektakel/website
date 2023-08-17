import {Input, InputProps, useFormControlContext} from '@chakra-ui/react';
import {FieldValidator, useField} from 'formik';
import React from 'react';

export default function FieldWrapper({
  as = Input,
  validate,
  ...props
}: InputProps & {
  validate?: FieldValidator;
}) {
  const {id, isRequired} = useFormControlContext();

  const [field, meta] = useField({
    name: id,
    validate: (v) => {
      if (isRequired && (v === '' || v == null)) {
        return 'empty';
      }
      if (validate) {
        return validate(v);
      }
    },
  });

  const inputProps: InputProps = {
    ...field,
    isInvalid: meta.touched && meta.error ? true : false,
    bg: 'white',
    ...props,
  };

  return React.createElement(as ?? Input, inputProps);
}
