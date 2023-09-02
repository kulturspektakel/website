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
import {useNavigate, useParams} from '@remix-run/react';
import {Steps, Step} from 'chakra-ui-steps';
import {$path} from 'remix-routes';
import {Formik, Form} from 'formik';
import Step1 from '~/components/booking/Step1';
import Step3 from '~/components/booking/Step3';
import Step2 from '~/components/booking/Step2';
import {createElement, useState} from 'react';
import type {CreateBandApplicationInput} from '~/types/graphql';
import {
  GenreCategory,
  HeardAboutBookingFrom,
  useCreateBandApplicationMutation,
} from '~/types/graphql';
import {gql} from '@apollo/client';
import ReloadWarning from '~/components/booking/ReloadWarning';
import {EVENT_ID} from './booking._index';

const STEPS = [Step1, Step2, Step3] as const;
export type FormikContextT = Partial<CreateBandApplicationInput>;

export type SearchParams = {
  applicationType: 'band' | 'dj';
};

gql`
  mutation CreateBandApplication(
    $eventId: ID!
    $data: CreateBandApplicationInput!
  ) {
    createBandApplication(eventId: $eventId, data: $data) {
      id
    }
  }
`;

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
  const {applicationType} = useParams<SearchParams>();
  const [create, {error}] = useCreateBandApplicationMutation();
  const isLastStep = currentStep === STEPS.length - 1;
  const navigate = useNavigate();

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
        initialValues={{
          heardAboutBookingFrom: utmSourceMapping[getUtmSource() ?? ''],
          genreCategory:
            applicationType === 'dj' ? GenreCategory.Dj : undefined,
        }}
        onSubmit={async (values) => {
          if (!isLastStep) {
            setCurrentStep(currentStep + 1);
            return;
          }

          let k: keyof CreateBandApplicationInput;
          for (k in values) {
            if (typeof values[k] === 'string') {
              // @ts-ignore
              values[k] = (values[k] as string).trim();
            }
          }
          const {data: res} = await create({
            variables: {
              data: values as CreateBandApplicationInput,
              eventId: EVENT_ID,
            },
            errorPolicy: 'all',
          });
          if (res?.createBandApplication?.id) {
            navigate(
              $path('/booking/:applicationType/danke', {
                applicationType,
              }),
            );
          }
        }}
        validateOnChange={false}
      >
        {(props) => (
          <Form>
            <VStack spacing="4">{createElement(STEPS[currentStep])}</VStack>
            <HStack w="100%" mt="4">
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
            <ReloadWarning dirty={props.dirty && !props.isSubmitting} />
          </Form>
        )}
      </Formik>
      {error && isLastStep && (
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
                {error.name}: {error.message}
              </Code>
            </AlertDescription>
          </Box>
        </Alert>
      )}
    </VStack>
  );
}
