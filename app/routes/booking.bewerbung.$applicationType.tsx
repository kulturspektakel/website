import {gql} from '@apollo/client';
import {VStack, HStack, Button, Spacer} from '@chakra-ui/react';
import type {ActionArgs, LoaderArgs} from '@remix-run/node';
import {Outlet, useActionData} from '@remix-run/react';
import {withZod} from '@remix-validated-form/with-zod';
import {Steps, Step} from 'chakra-ui-steps';
import {typedjson} from 'remix-typedjson';
import {ValidatedForm, useIsSubmitting, useIsValid} from 'remix-validated-form';
import {getSession} from '~/components/booking/session.server';
import useIsDJ from '~/components/booking/useIsDJ';
import type {CreateBandApplicationInput} from '~/types/graphql';
import {
  HeardAboutBookingFrom,
  GenreCategory,
  useCreateBandApplicationMutation,
  PreviouslyPlayed,
} from '~/types/graphql';
import {z} from 'zod';

gql`
  mutation CreateBandApplication($data: CreateBandApplicationInput!) {
    createBandApplication(data: $data) {
      id
    }
  }
`;

export type FormikContextT = Partial<CreateBandApplicationInput>;

export function getUtmSource() {
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('utm_source');
  }
}

export async function loader({request}: LoaderArgs) {
  const session = await getSession(request.headers.get('cookie'));
  console.log(session);

  return typedjson({});
}

const utmSourceMapping: Record<string, HeardAboutBookingFrom> = Object.freeze({
  fb: HeardAboutBookingFrom.Facebook,
  ig: HeardAboutBookingFrom.Instagram,
});

const step1Schema = z
  .object({
    bandname: z.string().min(1, {message: 'Email is required'}),
    description: z.string(),
    genre: z.string(),
    genreCategory: z.nativeEnum(GenreCategory),
    city: z.string(),
    numberOfArtists: z.string(),
    numberOfNonMaleArtists: z.string(),
  })
  .refine((data) => data.numberOfNonMaleArtists <= data.numberOfArtists);

const step2Schema = z.object({
  demo: z
    .string()
    .regex(
      /^(https?:\/\/)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?$/,
      'Ungültiger Link',
    ),
  instagram: z.string(),
  facebook: z.string(),
  website: z.string(),
});

const step3Schema = z.object({
  contactName: z.string(),
  email: z.string().email(),
  contactPhone: z.string(),
  knowsKultFrom: z.string(),
  hasPreviouslyPlayed: z.nativeEnum(PreviouslyPlayed),
  heardAboutBookingFrom: z.nativeEnum(HeardAboutBookingFrom),
});

export async function action({request}: ActionArgs) {
  const body = await request.formData();
  console.log(body);
  return typedjson({value: 1});
}

export default function () {
  let currentStep = 1;
  const formID = 'booking';
  const validator = withZod(step1Schema);
  const isSubmitting = useIsSubmitting(formID);
  const isValid = useIsValid(formID);
  const data = useActionData();
  console.log(data);
  const isDJ = useIsDJ();
  const [create, {error, loading}] = useCreateBandApplicationMutation();

  return (
    <div>
      <VStack spacing="5">
        <Steps
          activeStep={currentStep - 1}
          responsive={false}
          colorScheme="blue"
          display={['none', 'flex']}
        >
          <Step label="Infos" />
          <Step label="Musik" />
          <Step label="Kontakt" />
        </Steps>

        <ValidatedForm
          validator={validator}
          method="post"
          id={formID}
          action="/booking/bewerbung/band/schritt2"
        >
          {/* <Formik<FormikContextT>
            initialValues={{
              heardAboutBookingFrom: utmSourceMapping[getUtmSource() ?? ''],
              genreCategory: isDJ ? GenreCategory.Dj : undefined,
            }}
            onSubmit={async (values) => {
              if (currentStep === 3) {
                let k: keyof CreateBandApplicationInput;
                for (k in values) {
                  if (typeof values[k] === 'string') {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    values[k] = (values[k] as string).trim();
                  }
                }
                const {data: res} = await create({
                  variables: {
                    data: values as CreateBandApplicationInput,
                  },
                  errorPolicy: 'all',
                });
                if (res?.createBandApplication?.id) {
                  // await router.push(
                  //   `/booking/${router.query.applicationType}/danke`,
                  // );
                }
              } else {
                // setCurrentStep(currentStep + 1);
              }
            }}
            validateOnChange={false}
          > */}
          <Outlet />
          {/* </Formik> */}

          {isValid ? 'valid' : 'invalid'}

          <HStack w="100%">
            <Button isDisabled={isSubmitting} onClick={() => {}}>
              Zurück
            </Button>
            <Spacer />
            <Button
              colorScheme="blue"
              type="submit"
              isDisabled={isSubmitting || !isValid}
              isLoading={isSubmitting}
            >
              Weiter
            </Button>
          </HStack>
        </ValidatedForm>
      </VStack>
    </div>
  );
}
