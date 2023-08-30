import {VStack, HStack, Button, Spacer} from '@chakra-ui/react';
import type {ActionArgs, LoaderArgs} from '@remix-run/node';
import {Link, useParams} from '@remix-run/react';
import {withZod} from '@remix-validated-form/with-zod';
import {Steps, Step} from 'chakra-ui-steps';
import {redirect, typedjson, useTypedLoaderData} from 'remix-typedjson';
import {ValidatedForm, useIsSubmitting, useIsValid} from 'remix-validated-form';
import {$path} from 'remix-routes';
import {type ZodType, z} from 'zod';
import {getParams} from 'remix-params-helper';
import Step1 from '~/components/booking/Step1';
import Step3 from '~/components/booking/Step3';
import Step2 from '~/components/booking/Step2';
import {createElement, useMemo} from 'react';
import {getSession, commitSession} from '~/components/booking/session.server';
import {GenreCategory} from '~/types/graphql';
import {zfd} from 'zod-form-data';

const STEPS = [Step1, Step2, Step3] as const;
const GlobalSchema = z.intersection(Step1.schema, Step2.schema, Step3.schema);
export type CookieData = Partial<z.infer<typeof GlobalSchema>>;

const SearchParamsSchema = z.object({
  applicationType: z.enum(['band', 'dj']),
  step: zfd.numeric(z.number().int().min(1).max(STEPS.length)),
});
export type SearchParams = z.infer<typeof SearchParamsSchema>;

export async function loader({request, params}: LoaderArgs) {
  const result = getParams(params, SearchParamsSchema);
  if (!result.success) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }
  const session = await getSession(request.headers.get('cookie'));
  const sessionData = session.get('data') ?? {
    genreCategory:
      result.data.applicationType === 'dj' ? GenreCategory.Dj : undefined,
  };

  for (
    let lastValidStep = 1;
    lastValidStep < result.data.step;
    lastValidStep++
  ) {
    const validationResult = await withZod(
      STEPS[lastValidStep - 1].schema,
    ).validate(sessionData);
    if (validationResult.error) {
      // redirect to last valid step
      return redirect(
        $path('/booking/:applicationType/:step', {
          applicationType: result.data.applicationType,
          step: lastValidStep,
        }),
      );
    }
  }

  return typedjson(sessionData);
}

export const action = async ({request, params, context}: ActionArgs) => {
  const {data: p} = getParams(params, SearchParamsSchema);
  const session = await getSession(request.headers.get('cookie'));
  const {data} = await withZod(STEPS[(p?.step ?? 2) - 2].schema).validate(
    await request.formData(),
  );

  const oldData = session.get('data') ?? {};
  session.set('data', {...oldData, ...data});

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

export default function () {
  const formID = 'booking';
  const {applicationType, step} = SearchParamsSchema.parse(useParams());
  const isSubmitting = useIsSubmitting(formID);
  const isValid = useIsValid(formID);
  const data = useTypedLoaderData<typeof loader>();
  const validator = useMemo(() => withZod(STEPS[step - 1].schema), [step]);

  return (
    <VStack spacing="5">
      <Steps
        activeStep={step - 1}
        responsive={false}
        colorScheme="blue"
        display={['none', 'flex']}
      >
        <Step label="Infos" />
        <Step label="Musik" />
        <Step label="Kontakt" />
      </Steps>

      <ValidatedForm
        defaultValues={data ?? {}}
        validator={validator}
        action={$path('/booking/:applicationType/:step', {
          applicationType,
          step: step + 1,
        })}
        method="post"
        id={formID}
      >
        {createElement(STEPS[step - 1])}
        <HStack w="100%">
          <Button
            isDisabled={isSubmitting}
            as={Link}
            to={
              step > 1
                ? $path('/booking/:applicationType/:step', {
                    applicationType,
                    step: step - 1,
                  })
                : $path('/booking')
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
            {step === STEPS.length ? 'Absenden' : 'Weiter'}
          </Button>
        </HStack>
      </ValidatedForm>
    </VStack>
  );
}
