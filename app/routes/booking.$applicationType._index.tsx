import {
  VStack,
  HStack,
  Button,
  Spacer,
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Code,
  Heading,
} from '@chakra-ui/react';
import {useNavigate, useNavigation, useParams} from '@remix-run/react';
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
import Steps from '~/components/Steps';
import {WarningIcon} from '@chakra-ui/icons';

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
    <VStack gap="5">
      <Heading size="lg" mt="2">
        {applicationType === 'dj' ? 'DJ Bewerbung' : 'Bandbewerbung'}
      </Heading>

      <Steps
        mt="5"
        mb="5"
        currentStep={currentStep}
        display={['none', 'flex']}
        steps={['Infos', 'Musik', 'Kontakt']}
      />

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
            <VStack gap="4">{createElement(STEPS[currentStep])}</VStack>
            <HStack w="100%" mt="4">
              {currentStep > 0 && (
                <Button
                  disabled={props.isSubmitting || state != 'idle'}
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
          <WarningIcon />
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
