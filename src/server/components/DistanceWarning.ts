import {createServerFn} from '@tanstack/react-start';

export const getDistance = createServerFn()
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
