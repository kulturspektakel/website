import {gql} from '@apollo/client';
import {Alert, AlertDescription} from '@chakra-ui/react';
import {useDuplicateApplicationWarningQuery} from '../../types/graphql';
import type {loader as rootLoader} from '~/root';
import {useTypedRouteLoaderData} from 'remix-typedjson';
import {FaTriangleExclamation} from 'react-icons/fa6';

gql`
  query DuplicateApplicationWarning($bandname: String!, $eventId: ID!) {
    checkDuplicateApplication(bandname: $bandname, eventId: $eventId) {
      applicationTime
      obfuscatedEmail
    }
  }
`;

export default function DuplicateWarning(props: {bandname?: string}) {
  const {eventsConnection} =
    useTypedRouteLoaderData<typeof rootLoader>('root')!;
  const {data} = useDuplicateApplicationWarningQuery({
    variables: {
      bandname: props.bandname!,
      eventId: eventsConnection.edges[0].node.id,
    },
    skip: !props.bandname,
  });

  if (!data?.checkDuplicateApplication) {
    return null;
  }

  return (
    <Alert status="warning" borderRadius="md" alignItems="flex-start">
      <FaTriangleExclamation mt="0.5" />
      <AlertDescription color="yellow.900">
        Es sieht so aus als hätten wir von euch am{' '}
        {data.checkDuplicateApplication.applicationTime.toLocaleString(
          'de-DE',
          {timeZone: 'Europe/Berlin', timeStyle: 'short', dateStyle: 'medium'},
        )}{' '}
        Uhr schon eine Bewerbung erhalten. Wir haben eine Bestätigungsemail an{' '}
        {data.checkDuplicateApplication.obfuscatedEmail} geschickt.
      </AlertDescription>
    </Alert>
  );
}
