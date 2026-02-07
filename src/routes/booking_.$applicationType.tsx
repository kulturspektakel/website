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
import Step1, {schema as step1Schema} from '../components/booking/Step1';
import Step2, {schema as step2Schema} from '../components/booking/Step2';
import Step3, {schema as step3Schema} from '../components/booking/Step3';
import {createElement, useState} from 'react';

import ReloadWarning from '../components/ReloadWarning';
import Steps from '../components/Steps';
import {FaTriangleExclamation} from 'react-icons/fa6';
import {Alert} from '../components/chakra-snippets/alert';
import {createFileRoute, notFound, useNavigate} from '@tanstack/react-router';
import useIsDJ from '../components/booking/useIsDJ';
import {useMutation} from '@tanstack/react-query';
import {prismaClient} from '../utils/prismaClient';
import {scheduleTask} from '../utils/scheduleTask';
import {createServerFn} from '@tanstack/react-start';
import z from 'zod';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {
  GenreCategory,
  HeardAboutBookingFrom,
} from '../generated/prisma/browser';

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
const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema] as const;

// Server schema validates step3 + eventId and transforms spotifyArtist
const serverSchema = z
  .object({
    eventId: z.string(),
  })
  .and(step3Schema)
  .transform(({spotifyArtist, ...data}) => ({
    ...data,
    spotifyArtist: spotifyArtist ? spotifyArtist.id : null,
  }));

const createBandApplication = createServerFn()
  .inputValidator(serverSchema)
  .handler(async ({data}) => {
    const application = await prismaClient.bandApplication.create({
      data,
      select: {id: true},
    });
    await scheduleTask('createBandApplication', application);
  });

function BookingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const {applicationType} = Route.useParams();
  const isDJ = useIsDJ();
  const {event} = Route.useRouteContext();
  const {isPending, isSuccess, mutate, error, isError} = useMutation<
    void,
    Error,
    z.input<typeof serverSchema>
  >({
    onSuccess: () =>
      navigate({
        to: '/booking/$applicationType/danke',
        params: {
          applicationType,
        },
      }),
    mutationFn: (data) => createBandApplication({data}),
  });
  const isLastStep = currentStep === STEPS.length - 1;
  const navigate = useNavigate();
  const utmSource = Route.useSearch();

  return (
    <VStack gap="5">
      <Heading size="3xl" mt="2">
        {isDJ ? 'DJ Bewerbung' : 'Bandbewerbung'}
      </Heading>

      <Steps
        mt="5"
        mb="5"
        currentStep={currentStep}
        display={['none', 'flex']}
        steps={['Infos', 'Musik', 'Kontakt']}
      />

      <Formik<Partial<z.infer<typeof step3Schema>>>
        initialValues={{
          heardAboutBookingFrom: utmSource?.utm_source,
          genreCategory: isDJ ? GenreCategory.DJ : undefined,
        }}
        onSubmit={async (values) => {
          if (isLastStep) {
            mutate({
              ...values,
              eventId: event.id,
            } as z.input<typeof serverSchema>);
          } else {
            setCurrentStep(currentStep + 1);
          }
        }}
        validationSchema={toFormikValidationSchema(STEP_SCHEMAS[currentStep])}
        validateOnChange={false}
        validateOnBlur={false}
      >
        {({dirty, errors}) => (
          <>
            <Form style={{width: '100%'}}>
              <VStack gap="4">{createElement(STEPS[currentStep])}</VStack>
              <HStack w="100%" mt="4">
                {currentStep > 0 && (
                  <Button
                    disabled={isPending || isSuccess}
                    onClick={() => setCurrentStep(currentStep - 1)}
                    variant="subtle"
                  >
                    Zurück
                  </Button>
                )}
                <Spacer />
                <Button type="submit" loading={isPending || isSuccess}>
                  {isLastStep ? 'Absenden' : 'Weiter'}
                </Button>
              </HStack>
              <ReloadWarning dirty={dirty && !(isPending || isSuccess)} />
            </Form>
            {(Object.keys(errors).length > 0 || isError) && isLastStep && (
              <Alert status="error" borderRadius="md">
                <FaTriangleExclamation />
                <Box flex="1">
                  <AlertTitle mr={2}>
                    Die Bewerbung konnte nicht abgeschickt werden.
                  </AlertTitle>
                  <AlertDescription>
                    <p>
                      Bitte versuche es nochmals, falls es immer noch nicht
                      klappt, schreibe bitte eine Mail an{' '}
                      <strong>
                        {isDJ ? 'info' : 'booking'}
                        @kulturspektakel.de
                      </strong>
                      .
                    </p>
                    {error && (
                      <Code borderRadius="md">
                        {error.name}: {error.message}
                      </Code>
                    )}
                    {errors && (
                      <Code borderRadius="md">{JSON.stringify(errors)}</Code>
                    )}
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          </>
        )}
      </Formik>
    </VStack>
  );
}
