import {Alert} from '../chakra-snippets/alert';
import {useRouteContext} from '@tanstack/react-router';
import {getDuplicateApplication} from '../../server/components/DuplicateApplicationWarning';
import {useQuery} from '@tanstack/react-query';

export default function DuplicateWarning(props: {bandname?: string}) {
  const {event} = useRouteContext({from: '/booking_/$applicationType'});

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
      {data.applicationTime.toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        timeStyle: 'short',
        dateStyle: 'medium',
      })}{' '}
      Uhr schon eine Bewerbung erhalten. Wir haben eine Bestätigungsemail an{' '}
      {data.obfuscatedEmail} geschickt.
    </Alert>
  );
}
