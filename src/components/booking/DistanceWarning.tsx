import {Alert} from '../chakra-snippets/alert';
import {getDistance} from '../../server/components/DistanceWarning';
import {useQuery} from '@tanstack/react-query';

export default function DistanceWarning(props: {origin?: string}) {
  const {data} = useQuery({
    queryKey: ['distance', props.origin],
    queryFn: () => getDistance({data: props.origin!}),
    enabled: !!props.origin,
  });

  if (!data || data < 80_000) {
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
