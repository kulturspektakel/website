import {VStack, HStack, Button, Spacer} from '@chakra-ui/react';
import type {ActionArgs, LoaderArgs} from '@remix-run/node';
import {Link, useParams} from '@remix-run/react';
import {withZod} from '@remix-validated-form/with-zod';
import {Steps, Step} from 'chakra-ui-steps';
import {redirect, typedjson, useTypedLoaderData} from 'remix-typedjson';
import {ValidatedForm, useIsSubmitting, useIsValid} from 'remix-validated-form';
import {$path, type Routes} from 'remix-routes';
import {z} from 'zod';
import Step1 from '~/components/booking/Step1';
import {getParams} from 'remix-params-helper';
import Step3 from '~/components/booking/Step3';
import Step2 from '~/components/booking/Step2';
import {createElement} from 'react';
import {getSession, commitSession} from '~/components/booking/session.server';
import {GenreCategory} from '~/types/graphql';

export async function loader({request, params}: LoaderArgs) {
  const result = getParams(params, SearchParamsSchema);
  if (!result.success) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }
  const session = await getSession(request.headers.get('cookie'));

  let lastValidStep = result.data.step;
  while (lastValidStep > 1) {
    console.log('validating', lastValidStep - 1);
    const validationResult = await withZod(
      STEPS[lastValidStep - 1].schema,
    ).validate(session.get('data'));
    if (validationResult.error) {
      lastValidStep--;
    } else {
      break;
    }
  }
  // redirect to last valid step
  if (lastValidStep !== result.data.step) {
    return redirect(
      $path('/booking/bewerbung/:applicationType/:step', {
        applicationType: result.data.applicationType,
        step: lastValidStep,
      }),
    );
  }

  return typedjson(
    session.get('data') ?? {
      genreCategory:
        result.data.applicationType === 'dj' ? GenreCategory.Dj : undefined,
    },
  );
}

export const action = async ({request, params}: ActionArgs) => {
  const session = await getSession(request.headers.get('cookie'));
  const formData = Object.fromEntries(await request.formData());
  session.set('data', formData);

  return typedjson(null, {
    headers: {
      'set-cookie': await commitSession(session),
    },
  });
};

// function getUtmSource() {
//   if (typeof window !== 'undefined') {
//     return window.sessionStorage.getItem('utm_source');
//   }
// }

// const utmSourceMapping: Record<string, HeardAboutBookingFrom> = Object.freeze({
//   fb: HeardAboutBookingFrom.Facebook,
//   ig: HeardAboutBookingFrom.Instagram,
// });

export type CookieData = z.infer<typeof step3Schema>;

const SearchParamsSchema = z.object({
  applicationType: z.enum(['band', 'dj']),
  step: z.number().int().min(1).max(3),
});

export type SearchParams = {
  applicationType: 'band' | 'dj';
  step: 1 | 2 | 3;
};
//z.infer<typeof SearchParamsSchema>;

const STEPS = [Step1, Step2, Step3];

export default function () {
  const formID = 'booking';
  const {applicationType, step} =
    useParams<Routes['/booking/bewerbung/:applicationType/:step']['params']>();
  const activeStep = parseInt(String(step), 10);
  const isSubmitting = useIsSubmitting(formID);
  const isValid = useIsValid(formID);
  const data = useTypedLoaderData<typeof loader>();

  return (
    <VStack spacing="5">
      <Steps
        activeStep={activeStep - 1}
        responsive={false}
        colorScheme="blue"
        display={['none', 'flex']}
      >
        <Step label="Infos" />
        <Step label="Musik" />
        <Step label="Kontakt" />
      </Steps>

      <ValidatedForm
        defaultValues={data}
        validator={withZod(STEPS[activeStep - 1].schema)}
        method="post"
        id={formID}
      >
        {createElement(STEPS[activeStep - 1])}

        {isValid ? 'valid' : 'invalid'}

        <HStack w="100%">
          <Button
            isDisabled={isSubmitting}
            as={Link}
            to={
              activeStep > 1
                ? $path('/booking/bewerbung/:applicationType/:step', {
                    applicationType,
                    step: activeStep - 1,
                  })
                : $path('/booking/bewerbung')
            }
          >
            Zurück
          </Button>
          <Spacer />
          <Button
            colorScheme="blue"
            type="submit"
            isDisabled={isSubmitting || !isValid}
            isLoading={isSubmitting}
          >
            {activeStep === 3 ? 'Absenden' : 'Weiter'}
          </Button>
        </HStack>
      </ValidatedForm>
    </VStack>
  );
}
