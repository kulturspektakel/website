import {gql} from '@apollo/client';
import {useDuplicateApplicationWarningQuery} from '../../types/graphql';
import {Alert} from '../chakra-snippets/alert';
import {useRouteContext} from '@tanstack/react-router';

gql`
  query DuplicateApplicationWarning($bandname: String!, $eventId: ID!) {
    checkDuplicateApplication(bandname: $bandname, eventId: $eventId) {
      applicationTime
      obfuscatedEmail
    }
  }
`;

export default function DuplicateWarning(props: {bandname?: string}) {
  const {event} = useRouteContext({from: '/booking_/$applicationType'});
  const {data} = useDuplicateApplicationWarningQuery({
    variables: {
      bandname: props.bandname!,
      eventId: event.id,
    },
    skip: !props.bandname,
  });

  if (!data?.checkDuplicateApplication) {
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
      {data.checkDuplicateApplication.applicationTime.toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        timeStyle: 'short',
        dateStyle: 'medium',
      })}{' '}
      Uhr schon eine Bewerbung erhalten. Wir haben eine Bestätigungsemail an{' '}
      {data.checkDuplicateApplication.obfuscatedEmail} geschickt.
    </Alert>
  );
}
