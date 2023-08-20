import {VStack, HStack, Button, Spacer} from '@chakra-ui/react';
import type {ActionArgs, LoaderArgs} from '@remix-run/node';
import {Link, useParams} from '@remix-run/react';
import {withZod} from '@remix-validated-form/with-zod';
import {Steps, Step} from 'chakra-ui-steps';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import {ValidatedForm, useIsSubmitting, useIsValid} from 'remix-validated-form';
import {$path, type Routes} from 'remix-routes';
import {
  HeardAboutBookingFrom,
  GenreCategory,
  PreviouslyPlayed,
} from '~/types/graphql';
import {z} from 'zod';
import Step1 from '~/components/booking/Step1';
import {getParams} from 'remix-params-helper';
import Step3 from '~/components/booking/Step3';
import Step2 from '~/components/booking/Step2';
import {createElement} from 'react';
import {getSession, commitSession} from '~/components/booking/session.server';

export async function loader({request, params}: LoaderArgs) {
  const result = getParams(params, SearchParamsSchema);
  if (!result.success) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }
  const session = await getSession(request.headers.get('cookie'));
  // todo: redirect to previous step if not valid
  return typedjson(session.get('data') ?? {});
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

const step1Schema = z.object({
  bandname: z.string().nonempty(),
  description: z.string().nonempty(),
  genre: z.string(),
  genreCategory: z.nativeEnum(GenreCategory),
  city: z.string().nonempty(),
  numberOfArtists: z.string().nonempty().regex(/^\d+$/),
  numberOfNonMaleArtists: z.string().nonempty().regex(/^\d+$/),
});
// .superRefine((val, ctx) => {
//   if (val.numberOfArtists < val.numberOfNonMaleArtists) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.custom,
//       path: ['numberOfNonMaleArtists'],
//     });
//   }
// });

const step2Schema = z
  .object({
    demo: z
      .string()
      .nonempty()
      .regex(
        /^(https?:\/\/)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?$/,
        'Ungültiger Link',
      ),
    instagram: z.string(),
    facebook: z.string(),
    website: z.string(),
  })
  .merge(step1Schema);

export const step3Schema = z
  .object({
    contactName: z.string().nonempty(),
    email: z.string().nonempty().email(),
    contactPhone: z.string().nonempty(),
    knowsKultFrom: z.string(),
    hasPreviouslyPlayed: z.nativeEnum(PreviouslyPlayed),
    heardAboutBookingFrom: z.nativeEnum(HeardAboutBookingFrom),
  })
  .merge(step2Schema);

export type CookieData = z.infer<typeof step3Schema>;

const SearchParamsSchema = z.object({
  applicationType: z.enum(['band', 'dj']),
  step: z.number().int(),
});

export type SearchParams = {
  applicationType: 'band' | 'dj';
  step: 1 | 2 | 3;
};
//z.infer<typeof SearchParamsSchema>;

const STEPS = [Step1, Step2, Step3];
const SCHEMAS = [step1Schema, step2Schema, step3Schema];

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
        validator={withZod(SCHEMAS[activeStep - 1])}
        method="post"
        id={formID}
        action={
          step === 3
            ? $path('/booking/bewerbung/danke')
            : $path('/booking/bewerbung/:applicationType/:step', {
                applicationType,
                step: activeStep + 1,
              })
        }
      >
        {createElement(STEPS[activeStep - 1])}

        {isValid ? 'valid' : 'invalid'}

        <HStack w="100%">
          {activeStep > 1 && (
            <Button
              isDisabled={isSubmitting}
              as={Link}
              to={$path('/booking/bewerbung/:applicationType/:step', {
                applicationType,
                step: activeStep - 1,
              })}
            >
              Zurück
            </Button>
          )}
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
