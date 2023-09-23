import type {InputProps} from '@chakra-ui/react';
import {Input, useFormControlContext} from '@chakra-ui/react';
import type {FieldValidator} from 'formik';
import {useField} from 'formik';
import React, {forwardRef} from 'react';

export default forwardRef(function FieldWrapper(
  {
    as = Input,
    validate,
    ...props
  }: InputProps & {
    validate?: FieldValidator;
  },
  ref,
) {
  const {id, isRequired, isInvalid} = useFormControlContext();

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
    isInvalid: (meta.touched && meta.error) || isInvalid ? true : false,
    bg: 'white',
    ref,
    ...props,
  };

  return React.createElement(as ?? Input, inputProps);
});
