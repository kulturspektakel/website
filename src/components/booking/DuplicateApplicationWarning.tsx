import {Alert} from '../chakra-snippets/alert';
import {useLoaderData} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../server/prismaClient.server';
import {useQuery} from '@tanstack/react-query';
import {locale, timeZone} from '../../utils/dateUtils';

const getDuplicateApplication = createServerFn()
  .inputValidator((data: {bandname: string; eventId: string}) => data)
  .handler(async ({data}) => {
    const application = await prismaClient.bandApplication.findFirst({
      where: {
        bandname: {
          equals: data.bandname,
          mode: 'insensitive',
        },
        eventId: data.eventId,
      },
    });

    if (application == null) {
      return null;
    }

    return {
      obfuscatedEmail: application.email
        .split('@')
        .map((s, i) => {
          let tld = '';
          if (i === 1 && s.indexOf('.') > -1) {
            tld = '.' + s.split('.').pop();
          }
          return s.charAt(0) + '***' + tld;
        })
        .join('@'),
      applicationTime: application.createdAt,
    };
  });

export default function DuplicateWarning(props: {bandname?: string}) {
  const {event} = useLoaderData({from: '/_main'});

  const {data} = useQuery({
    queryKey: ['duplicateApplication', props.bandname, event.id],
    queryFn: () =>
      getDuplicateApplication({
        data: {bandname: props.bandname!, eventId: event.id},
      }),
    enabled: !!props.bandname,
  });

  if (!data) {
    return null;
  }

  return (
    <Alert
      status="warning"
      borderRadius="md"
      alignItems="flex-start"
      title="Schon beworben?"
    >
      Es sieht so aus als hätten wir von euch am{' '}
      {data.applicationTime.toLocaleString(locale, {
        timeZone,
        timeStyle: 'short',
        dateStyle: 'medium',
      })}{' '}
      Uhr schon eine Bewerbung erhalten. Wir haben eine Bestätigungsemail an{' '}
      {data.obfuscatedEmail} geschickt.
    </Alert>
  );
}
