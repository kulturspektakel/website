import {useState} from 'react';
import {Button, Stack, Text, Textarea} from '@chakra-ui/react';
import {FaWhatsapp} from 'react-icons/fa6';
import {LuMessageSquare, LuPhone} from 'react-icons/lu';
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
import {Switch} from '../chakra-snippets/switch';
import DateString from '../DateString';
import {
  AWARENESS_PHONE,
  AWARENESS_PHONE_WHATSAPP,
} from '../../utils/awarenessContact';

const helpSchema = z.object({
  name: z.string().trim().min(1, 'Bitte gib deinen Namen an.'),
  phone: z.string().trim().min(1, 'Bitte gib eine Telefonnummer an.'),
  message: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

type HelpValues = z.infer<typeof helpSchema>;

// Optional geolocation control. A switch that, when turned on, requests the
// browser location and writes a Google Maps link into the `location` form
// field. If the request is denied/fails, the switch flips back off.
function LocationField() {
  const {values, setFieldValue} = useFormikContext<HelpValues>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  // On while the location is set, and optimistically on during the request so
  // the switch doesn't snap back until we know the outcome.
  const checked = Boolean(values.location) || status === 'loading';

  const onToggle = (next: boolean) => {
    if (!next) {
      setFieldValue('location', '');
      setStatus('idle');
      return;
    }
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
      // Failure: leave `location` empty so the switch returns to off.
      () => setStatus('error'),
      {enableHighAccuracy: true, timeout: 10000},
    );
  };

  return (
    <Stack gap="1">
      <Switch checked={checked} onCheckedChange={(e) => onToggle(e.checked)}>
        Meinen Standort teilen
      </Switch>
      {status === 'error' && (
        <Text fontSize="sm" color="fg.error">
          Standort konnte nicht ermittelt werden.
        </Text>
      )}
    </Stack>
  );
}

export function AwarenessBox({
  available,
  nextOpen,
}: {
  available: boolean;
  nextOpen: Date | null;
}) {
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
        mb="6"
      >
        <Stack gap="3" mt="1">
          {available ? (
            'Unser Awareness-Team ist für dich da – vertraulich und jederzeit ansprechbar. Melde dich auf dem Weg, der dir am angenehmsten ist.'
          ) : (
            <Text>
              Unser Awareness-Team ist gerade nicht erreichbar.
              {nextOpen && (
                <>
                  {' '}
                  Wir sind ab{' '}
                  <DateString
                    date={nextOpen}
                    options={{
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    }}
                  />{' '}
                  Uhr wieder für dich da.
                </>
              )}
            </Text>
          )}
          <Stack
            direction={{base: 'column', sm: 'row'}}
            align={{base: 'stretch', sm: 'flex-start'}}
            gap="2"
          >
            {available ? (
              <Button asChild variant="surface">
                <a href={`tel:${AWARENESS_PHONE}`}>
                  <LuPhone />
                  Anrufen
                </a>
              </Button>
            ) : (
              <Button variant="surface" disabled>
                <LuPhone />
                Anrufen
              </Button>
            )}
            {available ? (
              <Button asChild variant="surface">
                <a
                  href={`https://wa.me/${AWARENESS_PHONE_WHATSAPP}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaWhatsapp />
                  WhatsApp
                </a>
              </Button>
            ) : (
              <Button variant="surface" disabled>
                <FaWhatsapp />
                WhatsApp
              </Button>
            )}
            <Button
              variant="surface"
              onClick={() => setDialogOpen(true)}
              disabled={!available}
            >
              <LuMessageSquare />
              Nachricht schreiben
            </Button>
          </Stack>
        </Stack>
      </Alert>

      <DialogRoot
        open={dialogOpen}
        onOpenChange={(e) => !e.open && setDialogOpen(false)}
        placement="center"
      >
        <DialogContent maxW={{base: 'calc(100% - 2rem)', sm: 'md'}}>
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
