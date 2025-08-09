import {
  VStack,
  HStack,
  Spacer,
  AlertDescription,
  AlertTitle,
  Box,
  Code,
  Heading,
  Button,
} from '@chakra-ui/react';
import {Formik, Form} from 'formik';
import Step1 from '../components/booking/Step1';
import Step3 from '../components/booking/Step3';
import Step2 from '../components/booking/Step2';
import {createElement, useState} from 'react';
import type {CreateBandApplicationInput, SpotifyArtist} from '../types/graphql';
import {
  GenreCategory,
  HeardAboutBookingFrom,
  useCreateBandApplicationMutation,
} from '../types/graphql';
import {gql} from '@apollo/client';
import ReloadWarning from '../components/ReloadWarning';
import Steps from '../components/Steps';
import {FaTriangleExclamation} from 'react-icons/fa6';
import {Alert} from '../components/chakra-snippets/alert';
import {createFileRoute, notFound, useNavigate} from '@tanstack/react-router';
import {useRouterState} from '@tanstack/react-router';

export function parseBookingParams(params: {applicationType: string}) {
  switch (params.applicationType) {
    case 'band':
      return {applicationType: 'band' as const};
    case 'dj':
      return {applicationType: 'dj' as const};
    default:
      throw notFound();
  }
}

export const Route = createFileRoute('/booking_/$applicationType')({
  component: BookingForm,
  validateSearch: (search: any) => {
    if (search.utm_source && typeof search.utm_source === 'string') {
      switch (search.utm_source) {
        case 'fb':
          return {utm_source: HeardAboutBookingFrom.Facebook};
        case 'ig':
          return {utm_source: HeardAboutBookingFrom.Instagram};
      }
    }
  },
  parseParams: parseBookingParams,
});

const STEPS = [Step1, Step2, Step3] as const;
export type FormikContextT = Partial<CreateBandApplicationInput> & {
  spotifyArtist?: SpotifyArtist;
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

function BookingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const {applicationType} = Route.useParams();
  const {event} = Route.useRouteContext();
  const [create, {error}] = useCreateBandApplicationMutation();
  const isLastStep = currentStep === STEPS.length - 1;
  const navigate = useNavigate();
  const utmSource = Route.useSearch();
  const routerState = useRouterState();
  const isNavigating = routerState.isLoading || routerState.isTransitioning;

  return (
    <VStack gap="5">
      <Heading size="3xl" mt="2">
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
          heardAboutBookingFrom: utmSource?.utm_source,
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
            navigate({
              to: '/booking/$applicationType/danke',
              params: {
                applicationType,
              },
            });
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
                  disabled={props.isSubmitting || isNavigating}
                  onClick={() => setCurrentStep(currentStep - 1)}
                  variant="subtle"
                >
                  Zurück
                </Button>
              )}
              <Spacer />
              <Button
                type="submit"
                loading={props.isSubmitting || isNavigating}
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
          <FaTriangleExclamation />
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
