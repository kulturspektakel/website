import {Alert} from '../chakra-snippets/alert';
import {createServerFn} from '@tanstack/react-start';
import {useQuery} from '@tanstack/react-query';

const getDistance = createServerFn()
  .inputValidator((data: string) => data)
  .handler(async ({data: origin}) => {
    const url = new URL(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
    );

    url.searchParams.set('origins', origin);
    url.searchParams.set(
      'destinations',
      'Germeringer Str. 41, 82131 Gauting, Germany',
    );
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY_SERVER!);
    const response = await fetch(url.toString());
    const data: {
      destination_addresses: string[];
      origin_addresses: string[];
      rows: Array<{
        elements: Array<
          | {
              distance: {
                text: string;
                value: number;
              };
              duration: {
                text: string;
                value: number;
              };
              status: 'OK';
            }
          | {
              status: 'NOT_FOUND';
            }
        >;
      }>;
      status: 'OK';
    } = await response.json();

    return (
      data.rows.at(0)?.elements.find((element) => element.status === 'OK')
        ?.distance?.value ?? null
    );
  });

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
