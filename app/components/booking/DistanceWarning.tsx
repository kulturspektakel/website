import {gql} from '@apollo/client';
import {Alert, AlertIcon, AlertDescription} from '@chakra-ui/react';
import {useDistanceQuery} from '../../types/graphql';

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
    <Alert status="warning" borderRadius="md" alignItems="flex-start">
      <AlertIcon mt="0.5" />
      <AlertDescription color="yellow.900">
        Unser Festival findet in Gauting statt und die meisten Bands kommen aus
        der Region. Wir freuen uns natürlich über eure Bewerbung, egal von wo
        ihr anreist. Trotzdem bitten wir euch zu überlegen, ob eine Anreise zu
        unserem Festival für euch realistisch und finanzierbar ist.
      </AlertDescription>
    </Alert>
  );
}
