import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import React from 'react';
import Field from './Field';
import useIsDJ from './useIsDJ';
import {useFormikContext} from 'formik';
import {FormikContextT} from '../../pages/booking/[applicationType]';

export default function Step2() {
  const isDJ = useIsDJ();
  const {errors} = useFormikContext<FormikContextT>();

  return (
    <>
      <FormControl id="demo" isRequired={!isDJ} isInvalid={!!errors.demo}>
        <FormLabel>Demomaterial: YouTube, Spotify, etc.</FormLabel>
        <FormHelperText mt="-2" mb="2">
          {isDJ
            ? `Bitte gib uns einen direkten Link zu ein paar Mixes/Beispielen von dir.`
            : `Bitte gebt uns einen direkten Link zu Demomaterial eurer Band,
              egal wo. Hauptsache wir können uns etwas von euch anhören.`}
        </FormHelperText>
        <Field
          type="text"
          placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          validate={(url) => {
            if (
              url &&
              !/^(https?:\/\/)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?$/.test(
                url,
              )
            ) {
              return 'ungültige URL';
            }
          }}
        />
        {errors.demo && <FormErrorMessage>Ungültiger Link</FormErrorMessage>}
      </FormControl>

      <FormControl id="instagram">
        <FormLabel>Instagram</FormLabel>
        <InputGroup>
          <InputLeftElement pointerEvents="none" color="gray.400">
            @
          </InputLeftElement>
          <Field placeholder="kulturspektakel" paddingStart="7" />
        </InputGroup>
      </FormControl>

      <FormControl id="facebook">
        <FormLabel>Facebook</FormLabel>
        <Field type="text" placeholder="https://facebook.com/kulturspektakel" />
      </FormControl>

      <FormControl id="website">
        <FormLabel>Webseite</FormLabel>
        <Field type="text" placeholder="https://kulturspektakel.de" />
      </FormControl>
    </>
  );
}
