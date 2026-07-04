import {useMemo, useState} from 'react';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';
import {Button, Input, Stack, Textarea} from '@chakra-ui/react';
import {prismaClient} from '../server/prismaClient.server';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {enqueueGcpTask} from '../server/enqueueGcpTask.server';
import {locale, timeZone} from '../utils/dateUtils';
import DateString from '../components/DateString';
import {Alert} from '../components/chakra-snippets/alert';
import {Field} from '../components/chakra-snippets/field';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../components/chakra-snippets/native-select';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../components/chakra-snippets/dialog';

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

// Everything the contact dialog needs, fetched from just the application id:
// band data, the event's date window, and the list of stages.
const loadContactData = createServerFn()
  .middleware([crewAuth])
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({data: applicationId}) => {
    const application = await prismaClient.bandApplication.findUnique({
      where: {id: applicationId},
      select: {
        id: true,
        bandname: true,
        contactName: true,
        email: true,
        eventId: true,
        lastContactedAt: true,
        contactedByViewer: {select: {displayName: true}},
      },
    });
    if (!application) {
      throw notFound();
    }
    const [event, stages] = await Promise.all([
      prismaClient.event.findUnique({
        where: {id: application.eventId},
        select: {start: true, end: true},
      }),
      // Areas are global (no event relation); some may not be band stages.
      prismaClient.area.findMany({
        select: {id: true, displayName: true},
        orderBy: {order: 'asc'},
      }),
    ]);
    if (!event) {
      throw notFound();
    }
    return {
      id: application.id,
      bandname: application.bandname,
      contactName: application.contactName ?? '',
      email: application.email ?? '',
      start: event.start,
      end: event.end,
      stages,
      lastContactedAt: application.lastContactedAt,
      contactedBy: application.contactedByViewer?.displayName ?? null,
    };
  });

// Enqueues a Cloud Task that sends the email via the Gmail API (impersonating
// booking@kulturspektakel.de) so it shows up in that account's Sent folder.
const sendBandContactEmail = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({
      applicationId: z.string(),
      to: z.string(),
      subject: z.string(),
      body: z.string(),
    }),
  )
  .handler(async ({data, context}) => {
    await enqueueGcpTask('send-gmail', {
      account: 'booking@kulturspektakel.de',
      to: data.to,
      subject: data.subject,
      text: data.body,
    });
    await prismaClient.bandApplication.update({
      where: {id: data.applicationId},
      data: {
        lastContactedAt: new Date(),
        contactedByViewerId: context.viewer?.id ?? null,
      },
    });
  });

// ---------------------------------------------------------------------------
// Template (single, hard-coded — no maizzle, no selection UI)
// ---------------------------------------------------------------------------

const TEMPLATE = {
  subject: 'Spielanfrage Kulturspektakel – {{bandname}}',
  body: `Hallo {{contact}},

wir würden euch ({{bandname}}) sehr gerne beim Kulturspektakel auf der {{stage}} am {{date}} um {{time}} Uhr spielen lassen.

{{payment}}Passt das bei euch? Dann freuen wir uns auf eure Rückmeldung.

Viele Grüße
Das Booking-Team`,
};

// `label` is the dropdown option; `text` is the sentence inserted before the
// closing question in the body (empty for "nichts", so it leaves no artifact).
const PAYMENT_OPTIONS = [
  {value: 'nichts', label: 'Keine', text: ''},
  {
    value: 'fahrtkosten',
    label: 'Fahrtkosten',
    text: 'Eure Fahrtkosten übernehmen wir selbstverständlich. ',
  },
  {
    value: 'gage',
    label: 'Gage',
    text: 'Für euren Auftritt zahlen wir euch eine Gage. ',
  },
];

type Vars = {
  stage: string;
  date: string;
  time: string;
  bandname: string;
  contact: string;
  payment: string;
};

function fillTemplate(text: string, vars: Vars): string {
  return text.replace(
    /\{\{(stage|date|time|bandname|contact|payment)\}\}/g,
    (_, key: keyof Vars) => vars[key] ?? '',
  );
}

// Inclusive list of every day in the event window. `value` is a locale-free
// ISO date (stable for state), `label` is the German day string shown.
// Half-hour slots from 10:00 to 22:00 (inclusive).
const TIME_OPTIONS = Array.from({length: 25}, (_, i) => {
  const h = 10 + Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const value = `${String(h).padStart(2, '0')}:${m}`;
  return {value, label: value};
});

function buildDayOptions(start: Date, end: Date) {
  const days: {value: string; label: string}[] = [];
  const cur = new Date(start);
  cur.setHours(12, 0, 0, 0); // noon avoids DST day-boundary slips
  const last = new Date(end);
  while (cur <= last) {
    days.push({
      value: cur.toLocaleDateString('en-CA', {timeZone}),
      label: cur.toLocaleDateString(locale, {
        timeZone,
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute(
  '/crew/booking/$eventId/$applicationId/contact',
)({
  component: BandContactRoute,
  loader: ({params}) => loadContactData({data: params.applicationId}),
});

function BandContactRoute() {
  const data = Route.useLoaderData();
  const {eventId, applicationId} = Route.useParams();
  const navigate = Route.useNavigate();
  const close = () =>
    navigate({
      to: '/crew/booking/$eventId/$applicationId',
      params: {eventId, applicationId},
    });

  const dayOptions = useMemo(
    () => buildDayOptions(new Date(data.start), new Date(data.end)),
    [data.start, data.end],
  );

  // Step 1 — selection.
  const [step, setStep] = useState<1 | 2>(1);
  const [to, setTo] = useState(data.email);
  const [payment, setPayment] = useState('');
  const [stage, setStage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Step 2 — the generated, editable email.
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  // The text as last generated; once the user edits away from it, going back
  // would discard their changes, so we lock the "Zurück" button.
  const [generated, setGenerated] = useState({subject: '', body: ''});

  const canProceed = Boolean(payment && stage && date && time.trim());
  const canSend = Boolean(to.trim() && subject.trim() && body.trim());
  const edited = subject !== generated.subject || body !== generated.body;

  // Generate the email from the template + selections and advance to step 2.
  const proceed = () => {
    const vars: Vars = {
      stage,
      date: dayOptions.find((o) => o.value === date)?.label ?? '',
      time,
      bandname: data.bandname,
      // Use the first name only (split on space) for a friendlier greeting.
      contact: data.contactName.split(' ')[0],
      payment: PAYMENT_OPTIONS.find((o) => o.value === payment)?.text ?? '',
    };
    const gen = {
      subject: fillTemplate(TEMPLATE.subject, vars),
      body: fillTemplate(TEMPLATE.body, vars),
    };
    setSubject(gen.subject);
    setBody(gen.body);
    setGenerated(gen);
    setStep(2);
  };

  const sendMutation = useMutation({
    mutationFn: () =>
      sendBandContactEmail({
        data: {applicationId, to, subject, body},
      }),
    onSuccess: () => close(),
  });

  return (
    <DialogRoot
      open
      onOpenChange={(e) => !e.open && close()}
      placement="center"
      size="lg"
      scrollBehavior="inside"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anfrage: {data.bandname}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          {step === 1 ? (
            <Stack gap="4">
              {data.lastContactedAt && (
                <Alert status="warning" title="Bereits kontaktiert">
                  Diese Band wurde am{' '}
                  <DateString
                    date={new Date(data.lastContactedAt)}
                    options={{day: 'numeric', month: 'long', year: 'numeric'}}
                  />
                  {data.contactedBy ? ` von ${data.contactedBy}` : ''} bereits
                  kontaktiert.
                </Alert>
              )}
              <Field label="Bühne">
                <NativeSelectRoot>
                  <NativeSelectField
                    value={stage}
                    items={data.stages.map((s) => ({
                      value: s.displayName,
                      label: s.displayName,
                    }))}
                    onChange={(e) => setStage(e.currentTarget.value)}
                  >
                    {/* Empty selection shown, but not a real option in the list. */}
                    <option value="" hidden>
                      Bühne wählen…
                    </option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field>
              <Field label="Tag">
                <NativeSelectRoot>
                  <NativeSelectField
                    value={date}
                    items={dayOptions}
                    onChange={(e) => setDate(e.currentTarget.value)}
                  >
                    <option value="" hidden>
                      Tag wählen…
                    </option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field>
              <Field label="Uhrzeit">
                <NativeSelectRoot>
                  <NativeSelectField
                    value={time}
                    items={TIME_OPTIONS}
                    onChange={(e) => setTime(e.currentTarget.value)}
                  >
                    <option value="" hidden>
                      Uhrzeit wählen…
                    </option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field>
              <Field label="Bezahlung">
                <NativeSelectRoot>
                  <NativeSelectField
                    value={payment}
                    items={PAYMENT_OPTIONS}
                    onChange={(e) => setPayment(e.currentTarget.value)}
                  >
                    <option value="" hidden>
                      Bezahlung wählen…
                    </option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field>
            </Stack>
          ) : (
            <Stack gap="4">
              <Field label="An">
                <Input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field label="Betreff">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
              <Field label="Nachricht">
                <Textarea
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
            </Stack>
          )}
        </DialogBody>
        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={close}>
                Abbrechen
              </Button>
              <Button onClick={proceed} disabled={!canProceed}>
                Weiter
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={edited}
              >
                Zurück
              </Button>
              <Button
                onClick={() => sendMutation.mutate()}
                loading={sendMutation.isPending}
                disabled={!canSend}
              >
                Senden
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
