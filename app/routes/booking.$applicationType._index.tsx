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
  Heading,
} from '@chakra-ui/react';
import {useNavigate, useNavigation, useParams} from '@remix-run/react';
import {Steps, Step} from 'chakra-ui-steps';
import type {Routes} from 'remix-routes';
import {$path} from 'remix-routes';
import {Formik, Form} from 'formik';
import Step1 from '~/components/booking/Step1';
import Step3 from '~/components/booking/Step3';
import Step2 from '~/components/booking/Step2';
import {createElement, useState} from 'react';
import type {CreateBandApplicationInput, SpotifyArtist} from '~/types/graphql';
import {
  GenreCategory,
  HeardAboutBookingFrom,
  useCreateBandApplicationMutation,
} from '~/types/graphql';
import {gql} from '@apollo/client';
import ReloadWarning from '~/components/booking/ReloadWarning';
import {useUtmSource} from './booking._index';
import type {loader as rootLoader} from '~/root';
import {useTypedRouteLoaderData} from 'remix-typedjson';
import {loader} from './booking';

const STEPS = [Step1, Step2, Step3] as const;
export type FormikContextT = Partial<CreateBandApplicationInput> & {
  spotifyArtist?: SpotifyArtist;
};

export type SearchParams = {
  utm_source?: string;
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

const utmSourceMapping: Record<string, HeardAboutBookingFrom> = Object.freeze({
  fb: HeardAboutBookingFrom.Facebook,
  ig: HeardAboutBookingFrom.Instagram,
});

export default function () {
  const [currentStep, setCurrentStep] = useState(0);
  const {applicationType} =
    useParams<Routes['/booking/:applicationType']['params']>();
  const event = useTypedRouteLoaderData<typeof loader>('routes/booking')!;
  const [create, {error}] = useCreateBandApplicationMutation();
  const isLastStep = currentStep === STEPS.length - 1;
  const navigate = useNavigate();
  const utm_source = useUtmSource();
  const {state} = useNavigation();
  const root = useTypedRouteLoaderData<typeof rootLoader>('root')!;

  return (
    <VStack spacing="5">
      <Heading size="lg" mt="2">
        {applicationType === 'dj' ? 'DJ Bewerbung' : 'Bandbewerbung'}
      </Heading>

      <Steps
        activeStep={currentStep}
        responsive={false}
        trackColor="offwhite.300"
        display={['none', 'flex']}
        sx={{
          '& .cui-steps__step-icon-container': {
            bg: 'offwhite.300',
            borderColor: 'offwhite.300',
            '&[aria-current=step]': {
              borderColor: 'brand.900',
            },
            '&[data-highlighted]': {
              borderColor: 'brand.900',
              bg: 'brand.900',
            },
          },
          '& .cui-steps__horizontal-step[data-highlighted]:not(:last-child):after':
            {
              bg: 'brand.900',
            },
        }}
      >
        <Step label="Infos" />
        <Step label="Musik" />
        <Step label="Kontakt" />
      </Steps>

      <Formik<FormikContextT>
        initialValues={{
          heardAboutBookingFrom: utmSourceMapping[utm_source ?? ''],
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
              data: {
                ...values,
                spotifyArtist: values.spotifyArtist?.id,
              } as CreateBandApplicationInput,
              eventId: event.id,
            },
            errorPolicy: 'all',
          });
          if (res?.createBandApplication?.id && applicationType) {
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
          <Form style={{width: '100%'}}>
            <VStack spacing="4">{createElement(STEPS[currentStep])}</VStack>
            <HStack w="100%" mt="4">
              {currentStep > 0 && (
                <Button
                  isDisabled={props.isSubmitting || state != 'idle'}
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Zurück
                </Button>
              )}
              <Spacer />
              <Button
                variant="primary"
                type="submit"
                isLoading={props.isSubmitting || state != 'idle'}
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
