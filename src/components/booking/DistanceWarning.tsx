import {gql} from '@apollo/client';
import {useDistanceQuery} from '../../types/graphql';
import {FaTriangleExclamation} from 'react-icons/fa6';
import {Alert} from '../chakra-snippets/alert';

gql`
  query Distance($origin: String!) {
    distanceToKult(origin: $origin)
  }
`;

export default function DistanceWarning(props: {origin?: string}) {
  const {data} = useDistanceQuery({
    variables: {
      origin: props.origin ?? '',
    },
    skip: !props.origin,
  });

  if (!data || !data.distanceToKult || data.distanceToKult < 80) {
    return null;
  }

  return (
    <Alert status="warning" title="Anreisekosten" variant="surface">
      Unser Festival findet in Gauting statt und die meisten Bands kommen aus
      der Region. Da wir in der Regel keine Aufwandsentschädigungen für weite
      Anreisen zahlen können, bitten wir euch zu überlegen ob die Anreise für
      euch realistisch und finanzierbar ist.
    </Alert>
  );
}
