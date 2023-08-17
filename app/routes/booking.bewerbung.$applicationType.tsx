import {gql} from '@apollo/client';
import {VStack, HStack, Button, Spacer} from '@chakra-ui/react';
import {Outlet} from '@remix-run/react';
import {Steps, Step} from 'chakra-ui-steps';
import {Formik} from 'formik';
import type {CreateBandApplicationInput} from '~/types/graphql';
import {
  HeardAboutBookingFrom,
  GenreCategory,
  useCreateBandApplicationMutation,
} from '~/types/graphql';

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

const utmSourceMapping: Record<string, HeardAboutBookingFrom> = Object.freeze({
  fb: HeardAboutBookingFrom.Facebook,
  ig: HeardAboutBookingFrom.Instagram,
});

export default function () {
  let step = 1;
  let isSubmitting = false;
  const isDJ = useIsDJ();
  const [create, {error, loading}] = useCreateBandApplicationMutation();

  return (
    <div>
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

        <Formik<FormikContextT>
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
              setCurrentStep(currentStep + 1);
            }
          }}
          validateOnChange={false}
        >
          <Outlet />
        </Formik>

        <HStack w="100%">
          <Button isDisabled={isSubmitting} onClick={() => {}}>
            Zurück
          </Button>
          <Spacer />
          <Button
            colorScheme="blue"
            type="submit"
            isDisabled={isSubmitting}
            isLoading={isSubmitting}
          >
            {'Weiter'}
          </Button>
        </HStack>
      </VStack>
    </div>
  );
}
