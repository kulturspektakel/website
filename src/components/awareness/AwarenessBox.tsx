import {useState} from 'react';
import {Button, HStack, Stack, Text, Textarea, Wrap} from '@chakra-ui/react';
import {FaPhone, FaWhatsapp} from 'react-icons/fa6';
import {LuHeartHandshake, LuMapPin, LuCheck} from 'react-icons/lu';
import {Formik, Form, Field as FormikField, useFormikContext} from 'formik';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {z} from 'zod';
import {useMutation} from '@tanstack/react-query';
import {Alert} from '../chakra-snippets/alert';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
import {ConnectedField} from '../forms/ConnectedField';
import {toaster} from '../chakra-snippets/toaster';
import {requestAwarenessHelp} from '../../server/requestAwarenessHelp';

// TODO: Awareness-Telefonnummer eintragen.
// PHONE_TEL: internationales Format für tel:-Links.
// PHONE_WHATSAPP: dieselbe Nummer ohne "+" und ohne Leerzeichen (wa.me-Format).
const PHONE_DISPLAY = '+49 1525 1234567';
const PHONE_TEL = '+4915251234567';
const PHONE_WHATSAPP = '4915251234567';

const helpSchema = z.object({
  name: z.string().trim().min(1, 'Bitte gib deinen Namen an.'),
  phone: z.string().trim().min(1, 'Bitte gib eine Telefonnummer an.'),
  message: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

type HelpValues = z.infer<typeof helpSchema>;

// Optional geolocation control. Writes a Google Maps link into the `location`
// form field; the browser shows its own permission prompt on request.
function LocationField() {
  const {values, setFieldValue} = useFormikContext<HelpValues>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        setFieldValue(
          'location',
          `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`,
        );
        setStatus('idle');
      },
      () => setStatus('error'),
      {enableHighAccuracy: true, timeout: 10000},
    );
  };

  if (values.location) {
    return (
      <HStack color="green.fg" fontSize="sm">
        <LuCheck />
        <Text>Standort hinzugefügt</Text>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setFieldValue('location', '')}
        >
          Entfernen
        </Button>
      </HStack>
    );
  }

  return (
    <Stack gap="1">
      <Button
        variant="outline"
        alignSelf="flex-start"
        onClick={requestLocation}
        loading={status === 'loading'}
      >
        <LuMapPin />
        Standort teilen
      </Button>
      {status === 'error' && (
        <Text fontSize="sm" color="fg.error">
          Standort konnte nicht ermittelt werden.
        </Text>
      )}
    </Stack>
  );
}

export function AwarenessBox() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const {mutate, isPending} = useMutation({
    mutationFn: (values: HelpValues) => requestAwarenessHelp({data: values}),
    onSuccess: () => {
      toaster.create({
        type: 'success',
        title: 'Anfrage gesendet',
        description: 'Das Awareness-Team meldet sich so schnell wie möglich.',
      });
      setDialogOpen(false);
    },
    onError: (error) => {
      toaster.create({
        type: 'error',
        title: 'Anfrage konnte nicht gesendet werden',
        description:
          'Bitte ruf uns an oder schreib uns per WhatsApp.' +
          (error instanceof Error ? ` (${error.message})` : ''),
      });
    },
  });

  return (
    <>
      <Alert
        status="info"
        variant="surface"
        title="Brauchst du Hilfe oder Unterstützung?"
        icon={<LuHeartHandshake />}
      >
        <Stack gap="3" mt="1">
          Unser Awareness-Team ist für dich da – vertraulich und jederzeit
          ansprechbar. Melde dich auf dem Weg, der dir am angenehmsten ist.
          <Wrap gap="2">
            <Button asChild colorPalette="blue">
              <a href={`tel:${PHONE_TEL}`}>
                <FaPhone />
                Anrufen
              </a>
            </Button>
            <Button asChild variant="outline" colorPalette="green">
              <a
                href={`https://web.whatsapp.com/send/?phone=${PHONE_WHATSAPP}&text&type=phone_number&app_absent=0`}
                target="_blank"
                rel="noreferrer"
              >
                <FaWhatsapp />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <LuHeartHandshake />
              Hilfe anfragen
            </Button>
          </Wrap>
        </Stack>
      </Alert>

      <DialogRoot
        open={dialogOpen}
        onOpenChange={(e) => !e.open && setDialogOpen(false)}
        placement="center"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hilfe anfragen</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <Formik<HelpValues>
            initialValues={{name: '', phone: '', message: '', location: ''}}
            validationSchema={toFormikValidationSchema(helpSchema)}
            validateOnChange={false}
            validateOnBlur={false}
            onSubmit={(values) => mutate(values)}
          >
            <Form>
              <DialogBody>
                <Stack gap="4">
                  <ConnectedField
                    name="name"
                    label="Name"
                    required
                    autoComplete="name"
                    placeholder="Dein Name"
                  />
                  <ConnectedField
                    name="phone"
                    label="Telefonnummer"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Wie erreichen wir dich?"
                  />
                  <ConnectedField name="message" label="Anliegen (optional)">
                    <FormikField
                      name="message"
                      as={Textarea}
                      rows={4}
                      placeholder="Beschreibe kurz, wie wir dir helfen können."
                    />
                  </ConnectedField>
                  <LocationField />
                </Stack>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="subtle"
                  onClick={() => setDialogOpen(false)}
                  type="button"
                >
                  Abbrechen
                </Button>
                <Button type="submit" loading={isPending}>
                  Anfrage senden
                </Button>
              </DialogFooter>
            </Form>
          </Formik>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
