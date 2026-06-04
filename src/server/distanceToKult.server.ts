/**
 * Geocode a free-text place (city) to a Google place id + lat/lng. Ported from
 * `~/api.kulturspektakel.de/src/queries/distanceToKult.ts`.
 */
export async function getPlace(place: string): Promise<{
  placeId: string;
  latitude: number;
  longitude: number;
} | void> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', place);
  url.searchParams.set('region', 'de');
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY_SERVER);
  const response = await fetch(url.toString());
  const data: {
    results: Array<{
      place_id: string;
      geometry: {location: {lat: number; lng: number}};
    }>;
    status: 'OK';
  } = await response.json();

  if (data.results.length) {
    return {
      placeId: data.results[0].place_id,
      latitude: data.results[0].geometry.location.lat,
      longitude: data.results[0].geometry.location.lng,
    };
  }
}

/**
 * Driving distance in km from a place id to the festival site, via the Google
 * Distance Matrix API. Returns null if no route is found.
 */
export async function getDistanceToKult(placeId: string): Promise<number | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', `place_id:${placeId}`);
  url.searchParams.set('destinations', 'Germeringer Str. 41, 82131 Gauting, Germany');
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('units', 'metric');
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY_SERVER);
  const response = await fetch(url.toString());
  const data: {
    rows: Array<{
      elements: Array<
        | {distance: {text: string; value: number}; status: 'OK'}
        | {status: 'NOT_FOUND'}
      >;
    }>;
    status: 'OK';
  } = await response.json();

  const meters = data.rows
    .at(0)
    ?.elements.find((element) => element.status === 'OK')?.distance?.value;

  return meters ? meters / 1000 : null;
}
