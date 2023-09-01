import {
  VStack,
  HStack,
  Button,
  Spacer,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Code,
} from '@chakra-ui/react';
import type {ActionArgs} from '@remix-run/node';
import {useParams, useSubmit} from '@remix-run/react';
import {Steps, Step} from 'chakra-ui-steps';
import {$path} from 'remix-routes';
import {Formik, Form} from 'formik';
import Step1 from '~/components/booking/Step1';
import Step3 from '~/components/booking/Step3';
import Step2 from '~/components/booking/Step2';
import {createElement, useCallback, useState} from 'react';
import type {
  CreateBandApplicationInput,
  CreateBandApplicationMutation,
} from '~/types/graphql';
import {
  CreateBandApplicationDocument,
  GenreCategory,
  HeardAboutBookingFrom,
} from '~/types/graphql';
import {gql} from '@apollo/client';
import {redirect, typedjson, useTypedActionData} from 'remix-typedjson';
import apolloClient from '~/utils/apolloClient';
import ReloadWarning from '~/components/booking/ReloadWarning';

const STEPS = [Step1, Step2, Step3] as const;
export type FormikContextT = Partial<CreateBandApplicationInput>;

export type SearchParams = {
  applicationType: 'band' | 'dj';
};

gql`
  mutation CreateBandApplication($data: CreateBandApplicationInput!) {
    createBandApplication(data: $data) {
      id
    }
  }
`;

export async function action({request}: ActionArgs) {
  const data: CreateBandApplicationInput = await request.json();
  console.log('action', data);
  // let k: keyof CreateBandApplicationInput;
  //         for (k in values) {
  //           if (typeof values[k] === 'string') {
  //             // @ts-ignore
  //             values[k] = (values[k] as string).trim();
  //           }
  //         }
  const {errors} = await apolloClient.mutate<CreateBandApplicationMutation>({
    mutation: CreateBandApplicationDocument,
    variables: {
      data,
    },
    errorPolicy: 'all',
  });

  if (errors != null && errors.length > 0) {
    return typedjson({error: errors[0], data});
  }

  return redirect($path('/booking/danke'));
}

export function getUtmSource() {
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('utm_source');
  }
}

const utmSourceMapping: Record<string, HeardAboutBookingFrom> = Object.freeze({
  fb: HeardAboutBookingFrom.Facebook,
  ig: HeardAboutBookingFrom.Instagram,
});

export default function () {
  const [currentStep, setCurrentStep] = useState(0);
  const actionData = useTypedActionData<typeof action>();
  const {applicationType} = useParams<SearchParams>();
  const submit = useSubmit();
  const isLastStep = currentStep === STEPS.length - 1;

  const onUnload = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
    return (e.returnValue = '');
  }, []);

  console.log(actionData);

  return (
    <VStack spacing="5">
      <Steps
        activeStep={currentStep}
        responsive={false}
        colorScheme="blue"
        display={['none', 'flex']}
      >
        <Step label="Infos" />
        <Step label="Musik" />
        <Step label="Kontakt" />
      </Steps>

      <Formik<FormikContextT>
        initialValues={
          actionData?.data ?? {
            heardAboutBookingFrom: utmSourceMapping[getUtmSource() ?? ''],
            genreCategory:
              applicationType === 'dj' ? GenreCategory.Dj : undefined,
          }
        }
        onSubmit={(values, bag) => {
          if (isLastStep) {
            submit(values, {method: 'post', encType: 'application/json'});
          } else {
            setCurrentStep(currentStep + 1);
            bag.setSubmitting(false);
          }
        }}
        validateOnChange={false}
      >
        {(props) => (
          <Form>
            {createElement(STEPS[currentStep])}
            <HStack w="100%">
              {currentStep > 0 && (
                <Button
                  isDisabled={props.isSubmitting}
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Zurück
                </Button>
              )}
              <Spacer />
              <Button
                colorScheme="blue"
                type="submit"
                isLoading={props.isSubmitting}
              >
                {isLastStep ? 'Absenden' : 'Weiter'}
              </Button>
            </HStack>
            {/* <ReloadWarning
              dirty={props.dirty && !props.isSubmitting}
              onUnload={onUnload}
            /> */}
          </Form>
        )}
      </Formik>
      {actionData?.error && isLastStep && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle mr={2}>
              Die Bewerbung konnte nicht abgeschickt werden.
            </AlertTitle>
            <AlertDescription>
              <p>
                Bitte versuche es nochmals, falls es immer noch nicht klappt,
                schreibe bitte eine Mail an{' '}
                <strong>
                  {applicationType === 'dj' ? 'info' : 'booking'}
                  @kulturspektakel.de
                </strong>
                .
              </p>
              <Code borderRadius="md">
                {actionData.error.name}: {actionData.error.message}
              </Code>
            </AlertDescription>
          </Box>
        </Alert>
      )}
    </VStack>
  );
}
