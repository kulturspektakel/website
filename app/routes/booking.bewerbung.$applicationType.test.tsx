import React, {useState} from 'react';
import Page from '~/components/booking/Page';
import useIsDJ from '~/components/booking/useIsDJ';
import Step from '~/components/booking/Step';
// import {useRouter} from 'next/router';
import type {CreateBandApplicationInput} from '~/types/graphql';
import {
  GenreCategory,
  HeardAboutBookingFrom,
  useCreateBandApplicationMutation,
} from '~/types/graphql';
import {gql} from '@apollo/client';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Code,
} from '@chakra-ui/react';

gql`
  mutation CreateBandApplication($data: CreateBandApplicationInput!) {
    createBandApplication(data: $data) {
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

export type FormikContextT = Partial<CreateBandApplicationInput>;

// eslint-disable-next-line @typescript-eslint/ban-types
type Props = {};

export default function Application(props: Props) {
  const isDJ = useIsDJ();
  const [create, {error, loading}] = useCreateBandApplicationMutation();
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <Page>
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
            setCurrentStep(currentStep + 1);
          }
        }}
        validateOnChange={false}
      >
        <Step
          nextButtonLabel={currentStep === 3 ? 'Bewerbung absenden' : undefined}
          onBack={async () => {
            if (currentStep === 1) {
              // await router.push('/');
            } else {
              setCurrentStep(currentStep - 1);
            }
          }}
          step={currentStep}
        >
          {React.createElement(STEPS[currentStep - 1])}
        </Step>
      </Formik> */}
      {!loading && error && (
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
                <strong>{isDJ ? 'info' : 'booking'}@kulturspektakel.de</strong>.
              </p>
              <Code borderRadius="md">
                {error.name}: {error.message}
              </Code>
            </AlertDescription>
          </Box>
        </Alert>
      )}
    </Page>
  );
}
